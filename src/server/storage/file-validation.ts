import path from "node:path";
import { z } from "zod";
import { StorageFilePurpose, StorageFileVisibility, StorageModule } from "@prisma/client";

export const DEFAULT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const blockedExtensions = new Set([".exe", ".sh", ".bat", ".cmd", ".js", ".mjs", ".html", ".htm", ".svg", ".php"]);
const optionalTextField = (maxLength: number) => z.preprocess(
  (value) => (value === null || value === undefined ? "" : value),
  z.string().max(maxLength),
);

export const storageConfigurationSchema = z.object({
  id: z.string().optional(),
  provider: z.enum(["aws_s3", "s3_compatible", "local_dev"]),
  displayName: z.string().min(2).max(120),
  status: z.enum(["draft", "active", "disabled", "error"]),
  bucketName: z.string().min(2).max(120),
  region: z.string().max(80).optional().or(z.literal("")),
  endpoint: z.string().url().optional().or(z.literal("")),
  forcePathStyle: z.coerce.boolean().default(false),
  publicBaseUrl: z.string().url().optional().or(z.literal("")),
  accessKeyId: z.string().optional().or(z.literal("")),
  secretAccessKey: z.string().optional().or(z.literal("")),
  sessionToken: z.string().optional().or(z.literal("")),
  signedUrlExpiresInSeconds: z.coerce.number().int().min(60).max(86_400).default(900),
  maxUploadSizeBytes: z.coerce.number().int().min(1_000).max(250_000_000).default(10_485_760),
  allowedMimeTypes: z.string().optional().or(z.literal("")),
});

export const storageUploadSchema = z.object({
  module: z.nativeEnum(StorageModule),
  purpose: z.nativeEnum(StorageFilePurpose),
  visibility: z.nativeEnum(StorageFileVisibility).default("private"),
  entityType: optionalTextField(80),
  entityId: optionalTextField(120),
  altText: optionalTextField(240),
  caption: optionalTextField(500),
});

export function parseAllowedMimeTypes(input?: string | null) {
  const values = (input ?? "")
    .split(/[\n,]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return values.length ? Array.from(new Set(values)) : DEFAULT_ALLOWED_MIME_TYPES;
}

export function validateFileInput(input: { filename: string; mimeType: string; sizeBytes: number; maxUploadSizeBytes: number; allowedMimeTypes: string[] }) {
  const mimeType = input.mimeType.toLowerCase();
  const extension = path.extname(input.filename).toLowerCase();

  if (input.sizeBytes <= 0) throw new Error("Uploaded file is empty.");
  if (input.sizeBytes > input.maxUploadSizeBytes) throw new Error("Uploaded file exceeds the configured maximum size.");
  if (!input.allowedMimeTypes.includes(mimeType)) throw new Error("This file type is not allowed.");
  if (blockedExtensions.has(extension)) throw new Error("This file extension is not allowed.");
  if (input.filename.includes("\0") || input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
    throw new Error("Filename contains unsafe path characters.");
  }

  return { mimeType, extension: extension || null };
}

export function sanitizeFilename(filename: string) {
  const parsed = path.parse(filename);
  const safeBase = parsed.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
  const safeExt = parsed.ext.toLowerCase().replace(/[^.\w]/g, "").slice(0, 16);
  return `${safeBase}${safeExt}`;
}
