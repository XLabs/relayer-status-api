import {
    jest,
    describe,
    test,
    expect,
    beforeEach,
  } from "@jest/globals";
import { ParsedVaaWithBytes, Environment, RelayJob, fetchVaaHash } from "@wormhole-foundation/relayer-engine";
import { DefaultEntityHandler } from "../../src/storage/model";

jest.mock("@wormhole-foundation/relayer-engine");

describe("DefaultEntityHandler", () => {
    
    let entityHandler: DefaultEntityHandler;
    const aVaa = { id: {}, emitterChain: 1, emitterAddress: Buffer.from([1]), sequence: 1n } as unknown as ParsedVaaWithBytes;
    const aRelayJob = { id: "jobId" } as unknown as RelayJob;

    beforeEach(() => {
        entityHandler = new DefaultEntityHandler();
        jest.clearAllMocks();
    });

    describe("mapToStorageDocument", () => {

        test("should forward environment", async () => {
            const expectedEnvironment = Environment.MAINNET;
            await entityHandler.mapToStorageDocument(aVaa, aRelayJob, expectedEnvironment);
            
            expect(fetchVaaHash).toBeCalledWith(aVaa.emitterChain, aVaa.emitterAddress, aVaa.sequence, expect.anything(), expectedEnvironment);
        });

    });
});