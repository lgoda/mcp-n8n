export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITIES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const stringifyMeta = (meta?: Record<string, unknown>): string => {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(meta)}`;
};

export const createLogger = (level: LogLevel): Logger => {
  const canLog = (target: LogLevel): boolean => LEVEL_PRIORITIES[target] >= LEVEL_PRIORITIES[level];

  return {
    debug: (message, meta) => {
      if (canLog("debug")) {
        console.debug(`[DEBUG] ${message}${stringifyMeta(meta)}`);
      }
    },
    info: (message, meta) => {
      if (canLog("info")) {
        console.info(`[INFO] ${message}${stringifyMeta(meta)}`);
      }
    },
    warn: (message, meta) => {
      if (canLog("warn")) {
        console.warn(`[WARN] ${message}${stringifyMeta(meta)}`);
      }
    },
    error: (message, meta) => {
      if (canLog("error")) {
        console.error(`[ERROR] ${message}${stringifyMeta(meta)}`);
      }
    }
  };
};
