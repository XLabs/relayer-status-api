import { Logger } from 'winston';
import { RelayJob, RelayerEvents, RelayerApp, Context, Next } from '@wormhole-foundation/relayer-engine';
import { ParsedVaaWithBytes } from "@wormhole-foundation/relayer-engine/lib";

import { withErrorHandling, tryTimes } from './utils';
import { setupStorage, StorageConfiguration } from "./storage";
import { DefaultRelayEntity, RelayStatus, EntityHandler, DefaultEntityHandler } from './storage/model';
import { getRelay } from './read-api';

export interface RelayStorageContext extends Context {
  storedRelay?: RelayMiddlewareInterface;
}

/**
 * storeRelayerEngineRelays attaches to a relayer-engine (@xlabs-xyz/relayer-engine) application 
 * and takes care of storing all relays that the relayer-engine considers a workflow
 * in thedatabase and updating the relay job properties as they become 
 * available (eg: errorMessage property when the relay is considered to have failed)
 * 
 * It automatically keeps all properties declared on MinimalRelayEntity up to date
 * 
 * it also adds `storedRelay` to the context (ctx.storedRelay), which is an interface that allows to manually
 * update some relay information that is not directly accessible to the relayer engine
 * (eg target transaction data like toTxHash, feeAmount, gasUsed, ...)
 * It's also possible to use the `storedRelay` interface to store arbitrary metadata
 * using the `addMetadata` method.
 * 
 * the interface added to the context (ctx.storedRelay) contains a method that allows to add arbitrary
 * metadata to the relay (ctx.storedRelay.addMetadata({ foo: 'bar' }).
 * All metadata added will be collected across all middleware and stored in the database as a single
 * operation after all middlewares have been executed.
 * Error handling is taken care of.
 * 
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
    const relay = await getRelay(entityHandler, ctx.vaa);

    // TODO:
    // double check with gabi and Relayer Engine code:
    //   - if the relay is already found it's safe to assume we are re-processing the vaa? (and thus we can call incrementAttempts)
    //   - if the relay is not found, it's safe to assume we are processing a new vaa? (and thus don't do anything since it'll be created on added event)

    if (relay) {
      // relay.incrementAttempts();
      ctx.storedRelay = new RelayMiddlewareInterface(relay);
    }

    await next();

    if (ctx.storedRelay?.touched()) {
      await withErrorHandling(logger)(tryTimes)(5, async () => {
        await relay.save();
      });
    }
  });
};

class RelayMiddlewareInterface {
  private changes = {};
  constructor(private relay: DefaultRelayEntity) {}

  public update(props: Record<string, any>) {
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
  });
};

const handleRelayCompleted = async (
  entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes, job?: RelayJob, logger?: Logger
) => {
  logger?.debug(`Completing relay: ${relayLogString(vaa)}`);
  let relay: typeof entityHandler.entity;

  await tryTimes(5, async () => {
    relay = await getRelay(entityHandler, vaa);
    if (!relay) throw new Error('Relay not found');
  });

  if (!relay) {
    logger?.warn(`Completed Relay Not Found on DB: ${JSON.stringify(vaa.id)}. Recreating...`);
    relay = await entityHandler.mapToStorageDocument(vaa, job, logger);
  }

  relay.completedAt = new Date(),
  relay.status = RelayStatus.REDEEMED;

  await tryTimes(5, async () => {
    await relay.save();
    logger?.debug(`Relay marked completed: ${relayLogString(vaa)}`);
  });
};

const handleRelayFailed = async (
  entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes, job?: RelayJob, logger?: Logger
) => {
  logger?.debug(`Failing relay: ${relayLogString(vaa)}`);

  let relay: typeof entityHandler.entity;

  await tryTimes(5, async () => {
    relay = await getRelay(entityHandler, vaa);
    if (!relay) throw new Error('Relay not found');
  });

  if (!relay) {
    logger?.warn(`Failed Relay Not Found on DB: ${JSON.stringify(vaa.id)}. Recreating...`);
    relay = await entityHandler.mapToStorageDocument(vaa, job, logger);
  }

  relay.status = RelayStatus.FAILED;
  relay.failedAt = new Date();

  await tryTimes(5, async () => {
    await relay.save();
    logger?.info(`Relay marked failed: ${relayLogString(vaa)}`);
  });
};

