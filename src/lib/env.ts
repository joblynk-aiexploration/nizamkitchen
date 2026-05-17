import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
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
  SMTP_USERNAME: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM_EMAIL: z.string().email().default("noreply@nizamkitchen.dev"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
  DEPLOYMENT_ENVIRONMENT: z.string().default("local"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  SESSION_DURATION_DAYS: process.env.SESSION_DURATION_DAYS,
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
  REDIS_URL: process.env.REDIS_URL,
  OBJECT_STORAGE_ENDPOINT: process.env.OBJECT_STORAGE_ENDPOINT,
  OBJECT_STORAGE_BUCKET: process.env.OBJECT_STORAGE_BUCKET,
  OBJECT_STORAGE_REGION: process.env.OBJECT_STORAGE_REGION,
  OBJECT_STORAGE_ACCESS_KEY: process.env.OBJECT_STORAGE_ACCESS_KEY,
  OBJECT_STORAGE_SECRET_KEY: process.env.OBJECT_STORAGE_SECRET_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USERNAME: process.env.SMTP_USERNAME,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
  LOG_LEVEL: process.env.LOG_LEVEL,
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  SENTRY_DSN: process.env.SENTRY_DSN,
  DEPLOYMENT_ENVIRONMENT: process.env.DEPLOYMENT_ENVIRONMENT,
});

if (!parsed.success) {
  console.error("Environment validation failed", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables.");
}

export const env = parsed.data;
