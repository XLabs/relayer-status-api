import { setupStorage, StorageConfiguration } from "./storage";

export type ApiConfiguration = {
  port: 'number',
  // app?: Koa,
  // mapRelayEntityToApiData?: (relayEntity: any) => any,

}

export async function startRelayDataApi(
  apiConfig: ApiConfiguration,
  storageConfig: StorageConfiguration,
) {
  const storage = await setupStorage(storageConfig);





}
