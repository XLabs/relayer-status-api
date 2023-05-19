import Koa from "koa";
import Router from "koa-router";
import { ParsedVaaWithBytes } from "@wormhole-foundation/relayer-engine";
import { setupStorage, StorageConfiguration } from "./storage";
import { EntityHandler, DefaultEntityHandler } from "./storage/model";
import winston from "winston";

export function getRelay(entityHandler: EntityHandler<any>, vaa: ParsedVaaWithBytes) {
  const { emitterChain, emitterAddress, sequence } = vaa.id;

  // TODO: do we need to check this? or can we assume that this will be present?
  // In other words: is it always safe to assume that the vaa is valid?
  if (!emitterChain || !emitterAddress || !sequence) {
    // logger.warning()
    throw new Error('Missing required parameter');
  }

  return entityHandler.entity.findOne({ where: { emitterChain, emitterAddress, sequence } });
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
  }
}

export type ApiConfiguration = {
  app?: Koa;
  port?: number;
  prefix?: string;
  logger?: winston.Logger;
}

export async function startRelayDataApi(
  storageConfig: StorageConfiguration,
  apiConfig: ApiConfiguration,
  entityHandler: EntityHandler<any> = new DefaultEntityHandler(),
) {
  const storage = await setupStorage(storageConfig);

  const {
    logger,
    port = 4200,
    app = new Koa(),
    prefix = '/relay-status-api',
  } = apiConfig;

  if (logger) app.use(logRequestMetricsMiddleware(logger));

  const router = new Router({ prefix });

  router.get('/', async (ctx: Koa.Context, next: Koa.Next) => {
    const txHash = ctx.query.txHash;

    if (!txHash) {
      ctx.status = 400;
      ctx.body = {
        error: 'Missing required parameter txHash',
      };
      return;
    }

    const relay = entityHandler.entity.findOne({ where: { txHash } });

    if (!relay) {
      ctx.status = 404;
      ctx.body = {
        error: 'Relay not found',
      };
    }

    let responseRelay;

    try {
      responseRelay = await entityHandler.mapToApiResponse(relay);
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        error: 'Failed to map relay to API response',
      };
    }

    ctx.body = responseRelay;
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
