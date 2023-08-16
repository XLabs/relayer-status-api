import { describe, test, expect, } from "@jest/globals";
import request from "supertest";
import { Environment } from "@wormhole-foundation/relayer-engine";
import { ApiConfiguration } from "../src";
import { DefaultEntityHandler, DefaultRelayEntity, EntityHandler } from "../src/storage/model";
import { createRelayJob, createVaa } from "./shared/entity-factory";
import { integrationTestRunner } from "./shared/integration-test";

const TEN_SECS = 10_000;
const ENV = Environment.DEVNET;

const entityHandler: EntityHandler<any> = new DefaultEntityHandler();

integrationTestRunner(async (apiConfig: ApiConfiguration) => {
    describe("read-api", () => {
        test("should get last N items", async () => {
            const expectedSize = 3;
            const emitterChain = 1;
            const otheremitterChain = 10;

            await givenPresentRelays(entityHandler, emitterChain, 4);
            await givenPresentRelays(entityHandler, otheremitterChain, 1);
            givenMaxListApiSize(apiConfig, expectedSize);

            const response = await request(apiConfig.app?.callback()).get(`/?emitterChain=${emitterChain}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(expectedSize);
            expect(Number(response.body[0].sequence)).toBeGreaterThan(Number(response.body[1].sequence));
        }, TEN_SECS);
    });
});

const givenPresentRelays = async (entityHandler: EntityHandler<any>, emitterChain: number, count: number) => {
    for (let index = 0; index < count; index++) {
        await entityHandler.mapToStorageDocument(createVaa(emitterChain, BigInt(index + 1)), createRelayJob(), ENV).then((entity: DefaultRelayEntity) => entity.save());
    }
};

const givenMaxListApiSize = (apiConfig: ApiConfiguration, queryLimit: number) => apiConfig.read = { queryLimit };
