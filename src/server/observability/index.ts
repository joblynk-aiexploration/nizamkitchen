import { env } from "@/lib/env";

export function getObservabilitySnapshot() {
  return {
    environment: env.DEPLOYMENT_ENVIRONMENT,
    logLevel: env.LOG_LEVEL,
    tracingConfigured: !!env.OTEL_EXPORTER_OTLP_ENDPOINT,
    errorTrackingConfigured: !!env.SENTRY_DSN,
    placeholders: {
      tracing: "OpenTelemetry exporter wiring can be added later.",
      metrics: "Prometheus/StatsD counters can be added later.",
      errorTracking: "Sentry SDK can be added later.",
    },
  };
}
