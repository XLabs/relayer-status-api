import Koa from "koa";
import winston from "winston";

export class ReadApiConfiguration {
  queryLimit: number = 15;
}

export type ApiConfiguration = {
  app?: Koa;
  port?: number;
  prefix?: string;
  logger?: winston.Logger;
  read?: ReadApiConfiguration;
};
