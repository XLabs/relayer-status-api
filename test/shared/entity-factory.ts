import { ChainId, SignedVaa, parseVaa } from "@certusone/wormhole-sdk";
import { RelayJob, parseVaaWithBytes } from "@xlabs/relayer-engine";

const vaa: SignedVaa = Buffer.from(
  "AQAAAAABAGYGQ1g8mB5UMkeq28zodCdhDUk8YSjRSseFmP3VkKHMDUuZmDpQ6ccsPSx+bUkDIDp+ud6Qfes9nvZcWHkH1tQAZNPDWAg9AQAAAgAAAAAAAAAAAAAAAPiQmC+TEN9X0A9lnPT9h+Za3tjXAAAAAAACh1YBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPoAAAAAAAAAAAAAAAAtPvycRQ/T797kaXe0xgF5CsiCNYAAgAAAAAAAAAAAAAAAI8moAJdzMbPwHp9OHVigKEOKVrXAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  "base64",
);

export const createVaa = (emitterChain?: number, sequence?: bigint) => {
  const parsedVaa = parseVaaWithBytes(vaa);
  if (emitterChain) {
    parsedVaa.emitterChain = emitterChain;
    parsedVaa.id.emitterChain = emitterChain as ChainId;
  }
  if (sequence) {
    parsedVaa.sequence = sequence;
    parsedVaa.id.sequence = sequence.toString();
  }

  return parsedVaa;
}

export const createRelayJob = () => ({ id: "jobId" } as unknown as RelayJob);

