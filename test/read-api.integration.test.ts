import { describe, test, expect } from "@jest/globals";
import Koa from "koa";
import request from "supertest";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { ParsedVaaWithBytes, Environment, RelayJob } from "@wormhole-foundation/relayer-engine";
import { startRelayDataApi, StorageConfiguration, ApiConfiguration, RelayDataApi } from "../src";
import { DefaultEntityHandler, DefaultRelayEntity, EntityHandler } from "../src/storage/model";
import { Server } from "http";

const ONE_MINUTE = 60_000;
const TEN_SECS = 10_000;
const MONGODB_PORT = 27017;
const ENV = Environment.DEVNET;

const mongodbContainer: GenericContainer = new GenericContainer("mongo:6.0.1");
let startedMongo: StartedTestContainer;
const entityHandler: EntityHandler<any> = new DefaultEntityHandler();
const apiConfig: ApiConfiguration = {
  app: new Koa(),
  prefix: ""
};
let server: Server | undefined;
let dataApi: RelayDataApi;

describe("read-api", () => {
  beforeAll(async () => {
    startedMongo = await mongodbContainer.withExposedPorts(MONGODB_PORT).start();

    const storageConfig: StorageConfiguration = {
      storageType: "mongodb",
      connectionUrl: `mongodb://${startedMongo.getHost()}:${startedMongo.getMappedPort(MONGODB_PORT)}`,
      databaseName: "wormhole-relay-test",
      abortOnConnectionError: true
    };

    dataApi = await startRelayDataApi(storageConfig, apiConfig, entityHandler);
    server = apiConfig.app?.listen(0);
  }, ONE_MINUTE);

  afterAll(async () => {
    await startedMongo.stop();
    await dataApi.onClose();
    server?.close();
  });

  describe("list", () => {
    test(
      "should get last N items",
      async () => {
        const expectedSize = 3;
        const emitterChain = 1;
        const otheremitterChain = 10;

        await givenPresentRelays(entityHandler, emitterChain, 4);
        await givenPresentRelays(entityHandler, otheremitterChain, 1);
        givenMaxListApiSize(apiConfig, expectedSize);

        const response = await request(apiConfig.app?.callback()).get(`/?emitterChain=${emitterChain}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(expectedSize);
        expect(response.body[0].sequence).toBeGreaterThan(response.body[1].sequence);
      },
      TEN_SECS
    );
  });
});

const givenPresentRelays = async (entityHandler: EntityHandler<any>, emitterChain: number, count: number) => {
  for (let index = 0; index < count; index++) {
    await entityHandler
      .mapToStorageDocument(createVaa(emitterChain, index + 1), createRelayJob(), ENV)
      .then((entity: DefaultRelayEntity) => entity.save());
  }
};

const givenMaxListApiSize = (apiConfig: ApiConfiguration, queryLimit: number) => (apiConfig.read = { queryLimit });

const createVaa = (emitterChain?: number, sequence?: number) =>
  ({
    id: { emitterChain: emitterChain || 1, emitterAddress: Buffer.from([1]), sequence: sequence || 1n }
  } as unknown as ParsedVaaWithBytes);

const createRelayJob = () => ({ id: "jobId" } as unknown as RelayJob);
