import { env } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel) {
  return levelOrder[level] >= levelOrder[env.LOG_LEVEL];
}

export function logEvent(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    context: context ?? {},
    environment: env.DEPLOYMENT_ENVIRONMENT,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}
