import { Logger } from 'winston';
import { RelayJob, RelayerEvents, RelayerApp, Context, Next } from '@wormhole-foundation/relayer-engine';
import { ParsedVaaWithBytes } from "@wormhole-foundation/relayer-engine/lib";

import { withErrorHandling, tryTimes, pick } from './utils';
import { setupStorage, StorageConfiguration } from "./storage";
import { DefaultRelayEntity, RelayStatus, EntityHandler, DefaultEntityHandler, MinimalRelayEntity } from './storage/model';
import { getRelay } from './read-api';

async function updateRelay(entityHandler: EntityHandler<any>, relay: DefaultRelayEntity, updates: Partial<MinimalRelayEntity>) {
  const validUpdates = pick(updates, entityHandler.properties);
  if (!Object.keys(validUpdates).length) return;
  await entityHandler.entity.update(pick(relay, ['_id']), validUpdates);
}
export interface RelayStorageContext extends Context {
  storedRelay?: RelayMiddlewareInterface;
}

/**
 * storeRelayerEngineRelays attaches to a relayer-engine (@xlabs-xyz/relayer-engine) application 
 * and takes care of persisting all VAAs that the relayer-engine creates a workflow for
 * 
 * It will also take care of updating the relay job properties as they become available. (eg: errorMessage
 * property when the relay is considered to have failed)
 * The properties this library automatically keeps up to date are declared on MinimalRelayEntity interface.
 * A class complying with the EntityHandler interface can be passed as parameter to customize the database
 * entity and how it's handled.
 * 
 * It also adds `storedRelay` to the context (ctx.storedRelay), which is an interface that allows to manually
 * update some relay information that is not directly accessible to the relayer engine
 * (eg target transaction data like toTxHash, feeAmount, gasUsed, ...)
 * It's also possible to use the `storedRelay` interface to store arbitrary metadata
 * using the `addMetadata` method.
 * 
 * All updates to a relay will be collected across all middleware and stored in the database in a single
 * operation after all middlewares have been executed.
 * 
 * By design this module aims not to interrupt the relayer-engine workflow and will not throw errors.
 * All database operation are automatically retryed with exponential back-off and errors are handled in case
 * of ultimately failing. 
 */
export function storeRelayerEngineRelays(
  app: RelayerApp<Context>,
  storageConfig: StorageConfiguration,
  entityHandler: EntityHandler<any> = new DefaultEntityHandler(),
) {
  let storageError: string;
  let storageReady = false;
  const { logger } = storageConfig;

  const storagePromise = setupStorage(storageConfig).then((storage) => {
    storageReady = true;
    return storage;
  }).catch((error) => {
    storageError = error.message;
    logger?.error(storageError);
  });

  const doWhenStorageIsReady = (fn: (...args: any[]) => any) => async (...args: any[]) => {
    if (storageError) throw new Error(storageError);
    if (!storageReady) await storagePromise;
    return fn(...args);
  };

  app.on(RelayerEvents.Added, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
    doWhenStorageIsReady(withErrorHandling(logger)(handleRelayAdded))(entityHandler, vaa, job, logger);
  });


  app.on(RelayerEvents.Completed, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
    doWhenStorageIsReady(withErrorHandling(logger)(handleRelayCompleted))(entityHandler, vaa, job, logger);
  });

  app.on(RelayerEvents.Failed, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
    doWhenStorageIsReady(withErrorHandling(logger)(handleRelayFailed))(entityHandler, vaa, job, logger);
  });

  app.use(async (ctx: RelayStorageContext, next: Next) => {
    const relay = await getRelayPossiblyOnCreateState(entityHandler, ctx.vaa);

    // TODO:
    // double check with gabi and Relayer Engine code:
    //   - if the relay is already found it's safe to assume we are re-processing the vaa? (and thus we can call incrementAttempts)
    //   - if the relay is not found, it's safe to assume we are processing a new vaa? (and thus don't do anything since it'll be created on added event)

    if (relay) {
      ctx.storedRelay = new RelayMiddlewareInterface(relay, entityHandler);
      ctx.storedRelay.incrementAttempts();
    }

    await next();

    if (ctx.storedRelay?.touched()) {
      await withErrorHandling(logger)(tryTimes)(5, async () => {
        await ctx.storedRelay.applyChanges();
      });
    }
  });
};

class RelayMiddlewareInterface {
  private changes = {};
  constructor(private relay: DefaultRelayEntity, private entityHandler: EntityHandler<any>) {}

  private update(props: Record<string, any>) {
    if (Object.keys(props).length) {
      Object.assign(this.changes, props);
    }

    return this;
  }

  public addMetadata(metadata: Record<string, any>) {
    const existing = this.relay.metadata || {};
    this.update({ metadata: { ...existing, ...metadata } });
    return this;
  }

  public incrementAttempts() {
    const attempts = (this.relay.attempts || 0) + 1;
    this.update({ attempts });
    return this;
  }

  public touched () {
    return Object.keys(this.changes).length > 0;
  }

  public async applyChanges() {
    await updateRelay(this.entityHandler, this.relay, this.changes);
  }
}

const relayLogString = (vaa: ParsedVaaWithBytes) => {
  return `${vaa.id.emitterChain}/${vaa.id.emitterAddress.substring(0, 6)}/${vaa.id.sequence}`;
};

const handleRelayAdded = async (
  entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes, job?: RelayJob, logger?: Logger
) => {
  logger?.debug(`Creating record for relay: ${relayLogString(vaa)}`);
  let relay = await getRelay(entityHandler, vaa);

  if (relay) {
    logger?.warn(`Vaa Relay was added twice: ${relayLogString(vaa)}`);
    relay.addedTimes = relay.addedTimes++;
  }

  else relay = await entityHandler.mapToStorageDocument(vaa, job, logger);

  await tryTimes(5, async () => {
    await relay.save();
    logger?.debug(`Relay Stored: ${relayLogString(vaa)}`);
  })
};

/**
 * By design relayer-status-api aims to have its execution decoupled from the main relayer-engine process.
 * For this reason, the update of the main properties of the relay entity, such as status, are executed 
 * responding to the relayer-engine events (added, completed, failed).
 * 
 * In some scenarios, however, this might generate race conditions since the 'completed' event might be
 * triggered before the original 'added' event has finished storing the relay entity on the database.
 * For this reason, we try to get the relay entity from the database a few times before giving up.
 * This retry functionality should be more than enough to solve for the race condition.
 */
async function getRelayPossiblyOnCreateState(entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes) {
  let relay: typeof entityHandler.entity;

  await tryTimes(5, async () => {
    relay = await getRelay(entityHandler, vaa);
    if (!relay) throw new Error('Relay not found');
  });

  return relay;
}

const handleRelayCompleted = async (
  entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes, job?: RelayJob, logger?: Logger
) => {
  logger?.debug(`Completing relay: ${relayLogString(vaa)}`);

  let relay = await getRelayPossiblyOnCreateState(entityHandler, vaa);

  if (!relay) {
    logger?.warn(`Completed Relay Not Found on DB: ${JSON.stringify(vaa.id)}. Recreating...`);
    relay = await entityHandler.mapToStorageDocument(vaa, job, logger);
  }

  const changes = { completedAt: new Date(), status: RelayStatus.REDEEMED };

  await tryTimes(5, async () => {
    await updateRelay(entityHandler, relay, changes);
    logger?.debug(`Relay marked completed: ${relayLogString(vaa)}`);
  })
};

const handleRelayFailed = async (
  entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes, job?: RelayJob, logger?: Logger
) => {
  logger?.debug(`Failing relay: ${relayLogString(vaa)}`);

  let relay = await getRelayPossiblyOnCreateState(entityHandler, vaa);

  if (!relay) {
    logger?.warn(`Failed Relay Not Found on DB: ${relayLogString(vaa)}. Recreating...`);
    relay = await entityHandler.mapToStorageDocument(vaa, job, logger);
  }

  const changes = { failedAt: new Date(), status: RelayStatus.FAILED };

  await tryTimes(5, async () => {
    await updateRelay(entityHandler, relay, changes);
    logger?.debug(`Relay marked failed: ${relayLogString(vaa)}`);
  }).catch((error) => {
    logger?.error(`Error marking relay failed: ${relayLogString(vaa)}: ${error}`);
  });
};

