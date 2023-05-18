import { fetchVaaHash, RelayJob, RelayerEvents, RelayerApp, Context, Next } from '@wormhole-foundation/relayer-engine';
// import { BaseEntity, DataSource } from 'typeorm';
// import { Logger } from "winston";
import { ParsedVaaWithBytes } from "@wormhole-foundation/relayer-engine/lib";

import { withErrorHandling, tryTimes } from './utils';
import { setupStorage, StorageConfiguration } from "./storage";
import { DefaultRelayEntity, RelayStatus } from './storage/model';
import { getRelay } from './read-api';
import winston from 'winston';

export interface RelayStorageContext extends Context {
  storedRelay: RelayMiddlewareInterface;
}

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

async function buildRelay(vaa: ParsedVaaWithBytes, job: RelayJob): Promise<DefaultRelayEntity> {
  // Question for the code reviewer: should we have our own implementation of fetchVaaHash? does it make sense to use 
  // the same implementation as the relayer-engine?
  const txHash = await fetchVaaHash(
    vaa.emitterChain,
    vaa.emitterAddress,
    vaa.sequence,
    new winston.Logger(), // TODO proper logging
    'testnet??'
  );

  const { emitterChain, emitterAddress, sequence } = vaa.id;

  const relay = new DefaultRelayEntity({
    emitterChain: emitterChain,
    emitterAddress: emitterAddress,
    sequence: sequence,
    vaa: vaa.bytes,
    status: RelayStatus.WAITING,
    receivedAt: new Date(),
    fromTxHash: txHash,
    attempts: 0,
    maxAttempts: job?.maxAttempts,
  })

  return relay;
}

const handleRelayAdded = withErrorHandling(async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
  let relay = await getRelay(vaa);

  if (relay) {
    console.warn(`Vaa Relay was added twice: ${JSON.stringify(vaa.id)}`);
    relay.addedTimes = relay.addedTimes++;
  }

  else relay = await buildRelay(vaa, job);

  return tryTimes(5, async () => {
    const result = await relay.save();
    // logger.debug(`Stored relay ${emitterChain} ${emitterAddress} ${sequence}. id: ${relay._id}`);
    return result;
  });
});

const handleRelayCompleted = withErrorHandling(async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
  let relay = await getRelay(vaa);

  if (!relay) {
    console.warn(`Completed Relay Not Found on DB: ${JSON.stringify(vaa.id)}. Recreating...`);
    relay = await buildRelay(vaa, job);
  }

  relay.completedAt = new Date(),
  relay.status = RelayStatus.REDEEMED;

  return tryTimes(5, async () => {
    const result = await relay.save();
    // logger.debug(`Marked completed: ${emitterChain} ${emitterAddress} ${sequence}`);
    return result;
  });
});

const handleRelayFailed = withErrorHandling(async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
  let relay = await getRelay(vaa);

  if (!relay) {
    console.warn(`Failed Relay Not Found on DB: ${JSON.stringify(vaa.id)}. Recreating...`);
    relay = await buildRelay(vaa, job);
  }

  relay.status = RelayStatus.FAILED;
  relay.failedAt = new Date();

  return tryTimes(5, async () => {
    const result = await relay.save();
    // logger.debug(`Marked failed: ${emitterChain} ${emitterAddress} ${sequence}`);
    return result;
  });
});

export function storeRelayerEngineRelays(app: RelayerApp<Context>, storageConfig: StorageConfiguration) {
  let storageError: string;
  let storageReady = false;

  const storagePromise = setupStorage(storageConfig).then((storage) => {
    storageReady = true;
    return storage;
  }).catch((error) => {
    storageError = error.message;
    console.error(storageError);
  });

  const doWhenStorageIsReady = (fn: (...args: any[]) => any) => async (...args: any[]) => {
    if (storageError) throw new Error(storageError);
    if (!storageReady) await storagePromise;
    return fn(...args);
  };

  app.on(RelayerEvents.Added, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
    doWhenStorageIsReady(handleRelayAdded)(vaa, job);
  });


  app.on(RelayerEvents.Completed, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
    doWhenStorageIsReady(handleRelayCompleted)(vaa, job);
  });

  app.on(RelayerEvents.Failed, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
    doWhenStorageIsReady(handleRelayFailed)(vaa, job);
  });

  app.use(async (ctx: RelayStorageContext, next: Next) => {
    const relay = await getRelay(ctx.vaa);

    // TODO:
    // double check with gabi and RE code:
    //   - if the relay is already found it's safe to assume we are re-processing the vaa? (and thus we can call incrementAttempts)
    //   - if the relay is not found, it's safe to assume we are processing a new vaa? (and thus don't do anything since it'll be created on added event)

    ctx.storedRelay = new RelayMiddlewareInterface(relay);

    await next();

    if (ctx.storedRelay.touched()) {
      await withErrorHandling(tryTimes)(5, async () => {
        await relay.save();
      });
    }
  });
};
