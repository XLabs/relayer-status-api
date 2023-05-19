import { startRelayDataApi, StorageConfiguration, ApiConfiguration } from "relay-status-api";

import { logger } from './logger';

(async function main() {
  const relayStoreConfiguration : StorageConfiguration = {
    storageType: 'mongodb',
    connectionUrl: 'mongodb://localhost:27017',
    databaseName: 'wormhole-relay',
    logger: logger.child({ label: 'storage' }),
    abortOnConnectionError: true,
    // datasourceOptions: {},
  } 


  const apiConfiguration : ApiConfiguration = {
    port: 4200,
    prefix: '/relay-status-api',
    logger: logger.child({ label: 'api' }),
  };

  startRelayDataApi(relayStoreConfiguration, apiConfiguration);
})()