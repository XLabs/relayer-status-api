import { setupStorage, StorageConfiguration } from "./storage"

// let storage;

// export function upsertRelayData(mapRelayDataToEntity?) {

// }

// export function storeRelayDataMiddleware(storageConfiguration?: StorageConfiguration, mapRelayDataToEntity?) {
//   // const mapRelayToEntity =
//   let ready = false;
//   const storage = setupStorage().then(() => {
//     ready = true;
//   });


//   async function handleMiddleware(ctx, next) {
//     const relay = ctx.relay;
//     let mapped;
//     try {
//       mapped = await mapRelayDataToEntity(relay);
//     } catch (error: Error) {
//       storageConfiguration?.logger?.error('Failed to parse relay data', error);
//       if (storageConfiguration?.onError) storageConfiguration.onError(error);
//       else throw error;
//     }

//     try {
      
//     } catch (error: Error) {
//       storageConfiguration?.logger?.error('Failed to store relay data', error);
//       if (storageConfiguration?.onError) await storageConfiguration.onError(error);
//       else throw error;
//     }
//   }

//   return (ctx, next) => {
//     if (ready) handleMiddleware(ctx, next);
//     else setTimeout(() => handleMiddleware(ctx, next), 100);
//   }
// }