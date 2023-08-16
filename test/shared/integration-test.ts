import { beforeAll, afterAll } from "@jest/globals";
import Koa from "koa";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { startRelayDataApi, StorageConfiguration, ApiConfiguration, storeRelayerEngineRelays } from "../../src";
import { DefaultEntityHandler, EntityHandler } from "../../src/storage/model";
import { Server } from "http";
import winston from "winston";
import { Context, Environment, RelayerApp } from "@wormhole-foundation/relayer-engine";

const ONE_MINUTE = 60_000;
const MONGODB_PORT = 27017;

const mongodbContainer: GenericContainer = new GenericContainer("mongo:6.0.1");
let startedMongo: StartedTestContainer;
const entityHandler: EntityHandler<any> = new DefaultEntityHandler();
const apiConfig: ApiConfiguration = {
    app: new Koa(),
    prefix: ''
};
let storageConfig: StorageConfiguration;
let server: Server | undefined;
const app = new RelayerApp(Environment.DEVNET);

export const integrationTestRunner = async (tests: (apiConfig: ApiConfiguration, app: RelayerApp<Context>) => Promise<void>) => {
    server = apiConfig.app?.listen(0);

    beforeAll(async () => {
        startedMongo = await mongodbContainer.withExposedPorts(MONGODB_PORT).start();

        storageConfig = {
            storageType: 'mongodb',
            connectionUrl: `mongodb://${startedMongo.getHost()}:${startedMongo.getMappedPort(MONGODB_PORT)}`,
            databaseName: 'wormhole-relay-test',
            abortOnConnectionError: true,
            logger: winston.createLogger({
                transports: [
                    new winston.transports.Console({
                        level: "debug"
                    }),
                ]
            })
        };

        await startRelayDataApi(storageConfig, apiConfig, entityHandler);
        storeRelayerEngineRelays(app, storageConfig, entityHandler);
    }, ONE_MINUTE);

    afterAll(async () => {
        await startedMongo.stop();

        server?.close();
    });

    await tests(apiConfig, app);
};