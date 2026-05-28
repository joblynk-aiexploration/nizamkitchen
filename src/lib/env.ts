import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));
const nodeEnv = process.env.NODE_ENV ?? "development";
const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("nk_session"),
  SESSION_DURATION_DAYS: z.coerce.number().int().positive().default(30),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  OBJECT_STORAGE_ENDPOINT: z.string().url().default("http://localhost:9000"),
  OBJECT_STORAGE_BUCKET: z.string().min(1).default("nizamkitchen"),
  OBJECT_STORAGE_REGION: z.string().min(1).default("us-east-1"),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1).default("minio"),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1).default("minio123"),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  EMAIL_FROM: z.string().email().default("noreply@nizamkitchen.dev"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  GOOGLE_MAPS_BROWSER_API_KEY: z.string().default(""),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().default(""),
  GOOGLE_PLACES_SERVER_API_KEY: z.string().default(""),
  GOOGLE_GEOCODING_API_KEY: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(""),
  GOOGLE_OAUTH_CALLBACK_URL: z.string().default(""),
  FACEBOOK_OAUTH_APP_ID: z.string().default(""),
  FACEBOOK_OAUTH_APP_SECRET: z.string().default(""),
  FACEBOOK_OAUTH_CALLBACK_URL: z.string().default(""),
  YOUTUBE_DATA_API_KEY: z.string().default(""),
  YOUTUBE_DISCOVERY_ENABLED: z.coerce.boolean().default(false),
  ENCRYPTION_KEY: z.string().default(""),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  SENTRY_DSN: z.string().optional(),
  ERROR_TRACKING_DSN: z.string().optional(),
  ERROR_TRACKING_ENABLED: z.coerce.boolean().default(false),
  DEPLOYMENT_ENVIRONMENT: z.string().default("local"),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production" || isNextProductionBuild) return;

  if (!value.SESSION_SECRET || value.SESSION_SECRET.length < 32) {
    ctx.addIssue({
      code: "custom",
      path: ["SESSION_SECRET"],
      message: "SESSION_SECRET is required in production and must be at least 32 characters.",
    });
  }

  if (!value.APP_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["APP_URL"],
      message: "APP_URL is required in production.",
    });
  }
});

export function validateEnv(raw: NodeJS.ProcessEnv) {
  return envSchema.safeParse({
    DATABASE_URL: raw.DATABASE_URL,
    SESSION_SECRET: raw.SESSION_SECRET,
    SESSION_COOKIE_NAME: raw.SESSION_COOKIE_NAME,
    SESSION_DURATION_DAYS: raw.SESSION_DURATION_DAYS,
    APP_URL: raw.APP_URL,
    NODE_ENV: raw.NODE_ENV ?? "development",
    REDIS_URL: raw.REDIS_URL,
    OBJECT_STORAGE_ENDPOINT: raw.OBJECT_STORAGE_ENDPOINT,
    OBJECT_STORAGE_BUCKET: raw.OBJECT_STORAGE_BUCKET,
    OBJECT_STORAGE_REGION: raw.OBJECT_STORAGE_REGION,
    OBJECT_STORAGE_ACCESS_KEY: raw.OBJECT_STORAGE_ACCESS_KEY,
    OBJECT_STORAGE_SECRET_KEY: raw.OBJECT_STORAGE_SECRET_KEY,
    SMTP_HOST: raw.SMTP_HOST,
    SMTP_PORT: raw.SMTP_PORT,
    SMTP_USER: raw.SMTP_USER ?? raw.SMTP_USERNAME,
    SMTP_PASS: raw.SMTP_PASS ?? raw.SMTP_PASSWORD,
    EMAIL_FROM: raw.EMAIL_FROM ?? raw.SMTP_FROM_EMAIL,
    LOG_LEVEL: raw.LOG_LEVEL,
    GOOGLE_MAPS_BROWSER_API_KEY: raw.GOOGLE_MAPS_BROWSER_API_KEY,
    GOOGLE_MAPS_SERVER_API_KEY: raw.GOOGLE_MAPS_SERVER_API_KEY,
    GOOGLE_PLACES_SERVER_API_KEY: raw.GOOGLE_PLACES_SERVER_API_KEY,
    GOOGLE_GEOCODING_API_KEY: raw.GOOGLE_GEOCODING_API_KEY,
    GOOGLE_OAUTH_CLIENT_ID: raw.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: raw.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_CALLBACK_URL: raw.GOOGLE_OAUTH_CALLBACK_URL,
    FACEBOOK_OAUTH_APP_ID: raw.FACEBOOK_OAUTH_APP_ID,
    FACEBOOK_OAUTH_APP_SECRET: raw.FACEBOOK_OAUTH_APP_SECRET,
    FACEBOOK_OAUTH_CALLBACK_URL: raw.FACEBOOK_OAUTH_CALLBACK_URL,
    YOUTUBE_DATA_API_KEY: raw.YOUTUBE_DATA_API_KEY,
    YOUTUBE_DISCOVERY_ENABLED: raw.YOUTUBE_DISCOVERY_ENABLED,
    ENCRYPTION_KEY: raw.ENCRYPTION_KEY,
    OTEL_EXPORTER_OTLP_ENDPOINT: raw.OTEL_EXPORTER_OTLP_ENDPOINT,
    SENTRY_DSN: raw.SENTRY_DSN,
    ERROR_TRACKING_DSN: raw.ERROR_TRACKING_DSN,
    ERROR_TRACKING_ENABLED: raw.ERROR_TRACKING_ENABLED,
    DEPLOYMENT_ENVIRONMENT: raw.DEPLOYMENT_ENVIRONMENT,
  });
}

const parsed = validateEnv({ ...process.env, NODE_ENV: nodeEnv });

if (!parsed.success) {
  console.error("Environment validation failed", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables.");
}

export const env = parsed.data;
