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
    const errorMessage = `Failed to initialize storage connection: ${error.message}`;

    if (abortOnConnectionError) {
      console.error(errorMessage);
      process.exit(1);
    }

    else throw new Error(errorMessage);
  }

  return DefaultRelayEntity;
}
