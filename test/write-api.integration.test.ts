import { describe, test, expect, } from "@jest/globals";
import request from "supertest";
import { Context, RelayerApp, RelayerEvents, fetchVaaHash } from "@wormhole-foundation/relayer-engine";
import { ApiConfiguration } from "../src";
import { createVaa } from "./shared/entity-factory";

import { integrationTestRunner } from "./shared/integration-test";

jest.mock("@wormhole-foundation/relayer-engine", () => ({
    ...jest.requireActual("@wormhole-foundation/relayer-engine"),
    fetchVaaHash: jest.fn(),
}));

const TEN_SECS = 10_000;

integrationTestRunner(async (apiConfig: ApiConfiguration, app: RelayerApp<Context>) => {
    describe("write-api", () => {
        test("should handle relay added event", async () => {
            const vaa = createVaa();
            app.emit(RelayerEvents.Added, vaa);

            await waitForExecution(
                async () => {
                    expect(fetchVaaHash).toHaveBeenCalledWith(vaa.emitterChain, vaa.emitterAddress, vaa.sequence, expect.anything(), app.env);
                    const response = await request(apiConfig.app?.callback()).get(`/?emitterChain=${vaa.emitterChain}`);

                    expect(response.status).toBe(200);
                }, 1000, 5
            );

        }, TEN_SECS);
    });
});

const waitForExecution = (expectation: () => Promise<void>, period: number, maxTimes: number) => {
    let count = 0;
    const timeouts: NodeJS.Timeout[] = [];
    return new Promise((resolve, reject) => {
        const maybeRun = (error: Error) => {
            if (count >= maxTimes) {
                timeouts.forEach(to => clearTimeout(to));
                reject(error);
                return;
            }
            timeouts.push(setTimeout(runner, period));
        };
        const runner = async () => {
            count += 1;
            try {
                await expectation();
                resolve(null);
            } catch (error) {
                maybeRun(error);
            }
        }
        timeouts.push(setTimeout(runner, 0));
    });
}

