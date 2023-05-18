import { Logger } from 'winston';
import { BaseEntity, DataSource, DataSourceOptions } from "typeorm";
import { DefaultRelayEntity } from "./model";

export interface BaseRelayEntity extends BaseEntity {
  emitterChain: string; // TODO: should this be wormhole-sdk.ChainId?
  emitterAddress: string;
  sequenceNumber: string;
}

export type StorageConfiguration = {
  connectionUrl: string;
  storageType: DataSourceOptions['type'];
  abortOnConnectionError?: boolean;
  databaseName?: string;
  datasourceOptions?: DataSourceOptions;
  logger?: Logger;
}

// {
//   uri = "mongodb://localhost:27017",
//   database = "relays",
// }: any

/**
 * Storage is a high level abstraction over any persistent storage solution.
 * We use typeorm to abstract away the underlying database.
 * 
 * In this initial version, DefaultRelayEntity is hardcoded, but we could extend this functionality
 * to support arbitrary entities injected by the user through configuration.
 * 
 * One important consideration regarding this is that storage is closely tied to the read-api and write-api.
 * For this reason we need to implement read and write api in a way such that mapping a vaa to a storage entity
 * and mapping a storage entity to a api-response can also be modified by the user, so that they can be sure to match
 * entity model they configured for storage.
 * 
 * Because storage is closely tied to the read and write api, this method won't be exported from the package to force the user
 * use read-api and write-api methods, which will facilitate ensuring that the storage and the api (read or write) are using the same entity.
 */
export async function setupStorage(config: StorageConfiguration): Promise<typeof DefaultRelayEntity> {
  const {
    storageType,
    connectionUrl,
    databaseName,
    datasourceOptions = {},
    abortOnConnectionError = true,
  } = config;

  const opts = {
    ...datasourceOptions,
    type: storageType,
    url: connectionUrl,
    database: databaseName,
    entities: [DefaultRelayEntity],
    synchronize: true,
  };

  const RelaysDS = new DataSource(opts as DataSourceOptions);

  try {
    await RelaysDS.initialize();
  } catch (error: any) {
    const errorMessage = `Failed to initialize storage connection. Error: ${error.message}`;

    if (abortOnConnectionError) {
      console.error(errorMessage);
      process.exit(1);
    }

    else throw new Error(errorMessage);
  }

  return DefaultRelayEntity;
}
