import pino from "pino";
import { injectable, singleton } from "tsyringe";

const $logger = pino({
  level: process.env.LOG_LEVEL || "debug",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss Z",
      ignore: "pid,hostname",
    },
  },
});

@injectable()
@singleton()
export class Logger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || "debug",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    });
  }

  info(...args: any[]) {
    this.logger.info(...(args as [any, ...any[]]));
  }

  debug(...args: any[]) {
    this.logger.debug(...(args as [any, ...any[]]));
  }

  error(...args: any[]) {
    this.logger.error(...(args as [any, ...any[]]));
  }

  warn(...args: any[]) {
    this.logger.warn(...(args as [any, ...any[]]));
  }
}

export default $logger;
