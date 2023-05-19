import { createLogger, transports, format } from 'winston';
import { CHAIN_ID_SOLANA } from '@certusone/wormhole-sdk';
import { RelayerApp, RelayerAppOpts, Environment, Next } from '@wormhole-foundation/relayer-engine';

import { storeRelayerEngineRelays, StorageConfiguration, RelayStorageContext } from 'relay-status-api';

import { logger } from './logger';

(async function main() {
  const env = Environment.TESTNET;

  // const REOptions: RelayerAppOpts = {};
  const app = new RelayerApp<RelayStorageContext>(env);

  const relayStoreConfiguration : StorageConfiguration = {
    storageType: 'mongodb',
    connectionUrl: 'mongodb://localhost:27017',
    databaseName: 'wormhole-relay',
    logger: logger.child({ label: 'storage' }),
    abortOnConnectionError: true,
    // datasourceOptions: {},
  } 

  storeRelayerEngineRelays(app, relayStoreConfiguration);

  app.chain(CHAIN_ID_SOLANA)
    .address(
      'DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe',
      async (ctx: RelayStorageContext, next: Next) => {
        logger.info('Received Vaa with sequence:' + JSON.stringify(ctx.vaa?.id.sequence));

        // TODO: Test adding metadata
      }
    );

  app.spy('localhost:7073');

  app.listen().then(() => {
    logger.info('App is listening :)');
  });
})()



