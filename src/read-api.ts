import { ParsedVaaWithBytes } from "@wormhole-foundation/relayer-engine";
import { setupStorage, StorageConfiguration } from "./storage";
import { DefaultRelayEntity } from "./storage/model";


export function getRelay(vaa: ParsedVaaWithBytes) {
  const { emitterChain, emitterAddress, sequence } = vaa.id;

  // TODO: do we need to check this? or can we assume that this will be present?
  // In other words: is it always safe to assume that the vaa is valid?
  if (!emitterChain || !emitterAddress || !sequence) {
    // logger.warning()
    throw new Error('Missing required parameter');
  }

  return DefaultRelayEntity.findOne({ where: { emitterChain, emitterAddress, sequence } });
}

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
