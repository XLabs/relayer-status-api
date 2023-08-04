import Koa from "koa";
import Router from "koa-router";
import winston from "winston";
import { ParsedVaaWithBytes } from "@wormhole-foundation/relayer-engine";

import { setupStorage, StorageConfiguration } from "./storage";
import { EntityHandler, DefaultEntityHandler } from "./storage/model";
import { pick } from './utils';
import { ApiConfiguration } from "./config";

const supportedQueryStringParams = [
  "fromTxHash",
  "emitterChain",
  "emitterAddress",
  "sequence",
  "status",
  "toTxHash",
  "fromChain",
  "toChain",
];

export function getRelay(entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes) {
  const { emitterChain, emitterAddress, sequence } = vaa.id;
  if (!emitterChain || !emitterAddress || !sequence) {
    throw new Error("Missing required parameter");
  }

  return entityHandler.entity.findOne({
    where: { emitterChain, emitterAddress, sequence },
  });
}

function logRequestMetricsMiddleware(logger: winston.Logger) {
  return async (ctx: Koa.Context, next: Koa.Next) => {
    const start = process.hrtime();
    await next();
    const [_, inNanos] = process.hrtime(start);
    const duration = inNanos / 1e6;
    logger.debug(`${ctx.method} ${ctx.url} ${ctx.status} ${duration}ms`, {
      method: ctx.method,
      url: ctx.url,
      duration,
      status: ctx.status,
    });
  };
}


export async function startRelayDataApi(
  storageConfig: StorageConfiguration,
  apiConfig: ApiConfiguration,
  entityHandler: EntityHandler<any> = new DefaultEntityHandler(),
) {
  await setupStorage(storageConfig);

  const { logger, port = 4200, app = new Koa(), prefix = "/relay-status-api" } = apiConfig;

  if (logger) app.use(logRequestMetricsMiddleware(logger));

  const router = new Router({ prefix });

  router.get("/", async (ctx: Koa.Context, next: Koa.Next) => {
    const query = pick(ctx.query, supportedQueryStringParams);

    if (query.emitterChain) query.emitterChain = parseInt(query.emitterChain);

    if (!Object.keys(query).length) {
      ctx.status = 400;
      ctx.body = {
        error: `No params found on query-string. Supported search params: ${supportedQueryStringParams.join(", ")}`,
      };
      return;
    }

    const relays = await entityHandler.list(query, apiConfig.read?.queryLimit ?? 15);

    if (!relays.length) {
      ctx.status = 404;
      ctx.body = {
        error: "Not Found.",
      };
    }

    const responseData = [];

    for (const relay of relays) {
      try {
        responseData.push(await entityHandler.mapToApiResponse(relay));
      } catch (error) {
        responseData.push({
          error: "Failed to map relay to API response",
          vaa: pick(relay, ["emitterAddress", "emitterChain", "sequence"]),
        });
      }
    }

    ctx.body = responseData;
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  if (!apiConfig.app) {
    app.listen(port, () => {
      logger?.info(`Relay Data API listening on port ${port}`);
    });
  }

  return app;
}
