type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function currentLevel(): LogLevel {
  if (process.env.NODE_ENV === "production") {
    return "info";
  }
  return (process.env.DENBOARD_LOG_LEVEL as LogLevel) || "debug";
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[currentLevel()];
}

function baseLog(level: LogLevel, message: string, meta?: unknown) {
  if (!shouldLog(level)) return;
  // eslint-disable-next-line no-console
  if (meta !== undefined) {
    console[level](`[DenBoard] ${message}`, { message, meta });
  } else {
    console[level](`[DenBoard] ${message}`);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => baseLog("debug", message, meta),
  info: (message: string, meta?: unknown) => baseLog("info", message, meta),
  warn: (message: string, meta?: unknown) => baseLog("warn", message, meta),
  error: (message: string, meta?: unknown) => baseLog("error", message, meta)
};

