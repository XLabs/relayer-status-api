import { fetchVaaHash, RelayJob, RelayerEvents, RelayerApp, Context } from '@wormhole-foundation/relayer-engine';
// import { BaseEntity, DataSource } from 'typeorm';
// import { Logger } from "winston";
import { ParsedVaaWithBytes } from "@wormhole-foundation/relayer-engine/lib";

import { withErrorHandling, tryTimes } from './utils';
import { setupStorage, StorageConfiguration } from "./storage";
import { DefaultRelayEntity } from './storage/model';

async function getRelay(entity: typeof DefaultRelayEntity, where: any) {
  return entity.findOne({ where });
}

async function buildRelay(vaa: ParsedVaaWithBytes, job: RelayJob): Promise<DefaultRelayEntity> {
  const relay = new DefaultRelayEntity();
  // get txHash
  // 

  return relay;
}

const handleRelayAdded = withErrorHandling(async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
  const { emitterChain, emitterAddress, sequence } = vaa.id;
  let relay = await getRelay(DefaultRelayEntity, { emitterChain, emitterAddress, sequence });

  if (relay) {
    console.warn(`Vaa Relay was added twice: ${JSON.stringify(vaa.id)}`);
    relay.addedTimes = relay.addedTimes++;
  }

  else {
    relay = await buildRelay(vaa, job);
  }

  let result;

  await tryTimes(5, async () => {
    result = await relay.save();
  });

  return result;
});

const handleRelayCompleted = withErrorHandling(async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {

});

const handleRelayFailed = withErrorHandling(async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {

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

  // TODO: middleware should be used so that we can record the attempts
  // app.use();

  // const handleRelayReceived = async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {};
  // app.on(RelayerEvents.Received, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
  //   doWhenStorageIsReady(handleRelayReceived)(vaa, job);
  // });

  // const handleRelaySkipped = async (vaa: ParsedVaaWithBytes, job?: RelayJob) => {};
  // app.on(RelayerEvents.Skipped, (vaa: ParsedVaaWithBytes, job?: RelayJob) => {
  //   doWhenStorageIsReady(handleRelaySkipped)(vaa, job);
  // });
};
