import { env } from "@/lib/env";

export function getObservabilitySnapshot() {
  return {
    environment: env.DEPLOYMENT_ENVIRONMENT,
    logLevel: env.LOG_LEVEL,
    tracingConfigured: !!env.OTEL_EXPORTER_OTLP_ENDPOINT,
    errorTrackingConfigured: Boolean(env.ERROR_TRACKING_ENABLED && (env.ERROR_TRACKING_DSN || env.SENTRY_DSN)),
    placeholders: {
      tracing: "OpenTelemetry exporter wiring can be added later.",
      metrics: "Prometheus/StatsD counters can be added later.",
      errorTracking: "External error tracking can be wired when ERROR_TRACKING_ENABLED and a DSN are configured.",
    },
  };
}
