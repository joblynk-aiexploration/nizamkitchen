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

const sensitiveKeyPattern = /(secret|password|token|api[_-]?key|authorization|cookie|session|credential|dsn|database_url)/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return "[redacted]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "object" && item ? sanitizeContext(item as Record<string, unknown>) : item));
  }

  if (typeof value === "object" && value !== null) {
    return sanitizeContext(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizeContext(context: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]),
  );
}

export function logEvent(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    context: context ? sanitizeContext(context) : {},
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

export function logError(message: string, error: unknown, context?: Record<string, unknown>) {
  logEvent("error", message, {
    ...(context ?? {}),
    error: error instanceof Error ? { name: error.name, message: error.message } : "Unknown error",
  });
}

export function logWarning(message: string, context?: Record<string, unknown>) {
  logEvent("warn", message, context);
}
