import { createLogger, transports, format } from "winston";

export const logger = createLogger({
  transports: [
    new transports.Console({
      level: "debug"
    })
  ],
  format: format.combine(
    format.colorize(),
    format.splat(),
    format.simple(),
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss.SSS"
    }),
    format.errors({ stack: true })
  )
});
