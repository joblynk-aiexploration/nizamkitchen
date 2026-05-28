import { logEvent, logWarning, logError as logObservabilityError } from "@/server/observability/logger";

export type LogContext = Record<string, unknown>;

export function info(message: string, context?: LogContext) {
  logEvent("info", message, context);
}

export function warn(message: string, context?: LogContext) {
  logWarning(message, context);
}

export function error(message: string, error: unknown, context?: LogContext) {
  logObservabilityError(message, error, context);
}

export { logEvent, logWarning, logObservabilityError as logError };
