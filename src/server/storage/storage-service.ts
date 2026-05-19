import crypto from "node:crypto";
import { StorageConfigurationStatus, StorageProvider, type StorageConfiguration, type StorageFile } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { decryptGatewayCredential, encryptGatewayCredential, isPaymentEncryptionConfigured, maskCredentialPreview } from "@/server/payments/credentials";
import { createAuditEvent } from "@/server/audit";
import { DEFAULT_ALLOWED_MIME_TYPES, parseAllowedMimeTypes, storageConfigurationSchema, storageUploadSchema, validateFileInput } from "@/server/storage/file-validation";
import { buildStorageObjectKey } from "@/server/storage/storage-keys";
import { S3StorageProvider } from "@/server/storage/providers/s3-provider";
import { LocalDevStorageProvider } from "@/server/storage/providers/local-provider";
import type { StorageConfigurationWithSecrets, StorageProviderClient } from "@/server/storage/storage-provider";
import type { StorageSession } from "@/server/storage/storage-permissions";
import { assertStorageAdmin, canAccessStorageFile } from "@/server/storage/storage-permissions";

export async function getActiveStorageConfiguration() {
  const config = await prisma.storageConfiguration.findFirst({ where: { status: "active" }, orderBy: { updatedAt: "desc" } });
  if (config) return withDecryptedSecrets(config);
  if (env.NODE_ENV === "production") throw new Error("S3 storage is not configured.");
  return localDevConfiguration();
}

export async function getStorageProvider() {
  const configuration = await getActiveStorageConfiguration();
  return { configuration, provider: providerForConfiguration(configuration) };
}

export async function getStorageProviderForFile(file: Pick<StorageFile, "provider" | "bucketName">) {
  const config = await prisma.storageConfiguration.findFirst({ where: { provider: file.provider, bucketName: file.bucketName, status: "active" }, orderBy: { updatedAt: "desc" } });
  const configuration = config ? withDecryptedSecrets(config) : file.provider === "local_dev" && env.NODE_ENV !== "production" ? localDevConfiguration(file.bucketName) : await getActiveStorageConfiguration();
  return { configuration, provider: providerForConfiguration(configuration) };
}

export async function listStorageConfigurations() {
  const configs = await prisma.storageConfiguration.findMany({ orderBy: { updatedAt: "desc" } });
  return configs.map((config) => ({
    ...config,
    accessKeyPreview: config.encryptedAccessKeyId ? maskedEncryptedPreview(config.encryptedAccessKeyId) : null,
    secretAccessKeyConfigured: Boolean(config.encryptedSecretAccessKey),
    sessionTokenConfigured: Boolean(config.encryptedSessionToken),
  }));
}

export async function saveStorageConfiguration(session: StorageSession, input: unknown) {
  assertStorageAdmin(session);
  const parsed = storageConfigurationSchema.parse(input);
  if ((parsed.accessKeyId || parsed.secretAccessKey || parsed.sessionToken) && !isPaymentEncryptionConfigured()) {
    throw new Error("ENCRYPTION_KEY is required before saving storage credentials.");
  }
  const existing = parsed.id ? await prisma.storageConfiguration.findUnique({ where: { id: parsed.id } }) : null;
  const credentialData = {
    ...(parsed.accessKeyId ? { encryptedAccessKeyId: encryptGatewayCredential(parsed.accessKeyId) } : {}),
    ...(parsed.secretAccessKey ? { encryptedSecretAccessKey: encryptGatewayCredential(parsed.secretAccessKey) } : {}),
    ...(parsed.sessionToken ? { encryptedSessionToken: encryptGatewayCredential(parsed.sessionToken) } : {}),
  };
  const data = {
    provider: parsed.provider,
    displayName: parsed.displayName,
    status: parsed.status,
    bucketName: parsed.bucketName,
    region: parsed.region || null,
    endpoint: parsed.endpoint || null,
    forcePathStyle: parsed.forcePathStyle,
    publicBaseUrl: parsed.publicBaseUrl || null,
    signedUrlExpiresInSeconds: parsed.signedUrlExpiresInSeconds,
    maxUploadSizeBytes: parsed.maxUploadSizeBytes,
    allowedMimeTypesJson: parseAllowedMimeTypes(parsed.allowedMimeTypes),
    updatedById: session.user.id,
    ...credentialData,
  };
  const config = existing
    ? await prisma.storageConfiguration.update({ where: { id: existing.id }, data })
    : await prisma.storageConfiguration.create({ data: { ...data, createdById: session.user.id } });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: existing ? "storage_configuration.updated" : "storage_configuration.created",
    targetType: "storage_configuration",
    targetId: config.id,
    details: { provider: config.provider, bucketName: config.bucketName, credentialsUpdated: Object.keys(credentialData).length > 0 },
  });
  if (Object.keys(credentialData).length > 0) {
    await createAuditEvent({ actorUserId: session.user.id, action: "storage_configuration.credentials_updated", targetType: "storage_configuration", targetId: config.id });
  }
  return config;
}

export async function uploadStorageFile(session: StorageSession, input: Record<string, unknown> & { file: File }) {
  const parsed = storageUploadSchema.parse(input);
  const { configuration, provider } = await getStorageProvider();
  const arrayBuffer = await input.file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);
  const validation = validateFileInput({
    filename: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: body.byteLength,
    maxUploadSizeBytes: configuration.maxUploadSizeBytes,
    allowedMimeTypes: allowedMimeTypes(configuration),
  });
  const fileId = crypto.randomUUID();
  const organizationId = session.activeOrganization?.id ?? null;
  const countryCode = session.activeOrganization?.countryCode ?? null;
  const objectKey = buildStorageObjectKey({
    countryCode,
    organizationId,
    module: parsed.module,
    entityType: parsed.entityType || null,
    entityId: parsed.entityId || null,
    purpose: parsed.purpose,
    fileId,
    originalFilename: input.file.name,
  });
  await provider.uploadFile({ objectKey, body, mimeType: validation.mimeType });
  const checksumSha256 = crypto.createHash("sha256").update(body).digest("hex");
  const file = await prisma.storageFile.create({
    data: {
      id: fileId,
      organizationId,
      userId: parsed.module === "users" ? session.user.id : null,
      uploadedById: session.user.id,
      countryCode,
      module: parsed.module,
      entityType: parsed.entityType || null,
      entityId: parsed.entityId || null,
      provider: configuration.provider,
      bucketName: configuration.bucketName,
      objectKey,
      originalFilename: input.file.name,
      storedFilename: objectKey.split("/").at(-1) ?? fileId,
      mimeType: validation.mimeType,
      fileExtension: validation.extension,
      sizeBytes: body.byteLength,
      checksumSha256,
      visibility: parsed.visibility,
      purpose: parsed.purpose,
      altText: parsed.altText || null,
      caption: parsed.caption || null,
    },
  });
  await prisma.storageFileAccessLog.create({ data: { fileId: file.id, userId: session.user.id, action: "uploaded" } });
  await createAuditEvent({ actorUserId: session.user.id, organizationId, countryCode, action: "storage_file.uploaded", targetType: "storage_file", targetId: file.id, details: { purpose: file.purpose, mimeType: file.mimeType } });
  return file;
}

export async function getStorageFileUrl(session: StorageSession, fileId: string, request?: { ipAddress?: string | null; userAgent?: string | null }) {
  const file = await prisma.storageFile.findUnique({ where: { id: fileId } });
  if (!file || !canAccessStorageFile(session, file)) throw new Error("File not found.");
  const { createSignedReadUrl } = await import("@/server/storage/signed-urls");
  const signed = await createSignedReadUrl(session, file, request);
  await prisma.storageFileAccessLog.create({ data: { fileId: file.id, userId: session.user.id, action: "signed_url_created", ipAddress: request?.ipAddress ?? null, userAgent: request?.userAgent ?? null } });
  await createAuditEvent({ actorUserId: session.user.id, organizationId: file.organizationId, countryCode: file.countryCode, action: "storage_file.signed_url_created", targetType: "storage_file", targetId: file.id });
  return signed;
}

export async function deleteStorageFile(session: StorageSession, fileId: string) {
  const file = await prisma.storageFile.findUnique({ where: { id: fileId } });
  if (!file || !canAccessStorageFile(session, file)) throw new Error("File not found.");
  const { provider } = await getStorageProviderForFile(file);
  await provider.deleteFile({ objectKey: file.objectKey });
  const updated = await prisma.storageFile.update({ where: { id: file.id }, data: { status: "deleted", deletedAt: new Date() } });
  await prisma.storageFileAccessLog.create({ data: { fileId: file.id, userId: session.user.id, action: "deleted" } });
  await createAuditEvent({ actorUserId: session.user.id, organizationId: file.organizationId, countryCode: file.countryCode, action: "storage_file.deleted", targetType: "storage_file", targetId: file.id });
  return updated;
}

export async function listStorageFiles(session: StorageSession) {
  if (session.user.platformRole) {
    return prisma.storageFile.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }
  return prisma.storageFile.findMany({ where: { organizationId: session.activeOrganization?.id, status: { not: "deleted" } }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function runStorageTest(session: StorageSession, kind: "connection" | "upload" | "read" | "delete") {
  assertStorageAdmin(session);
  const config = await getActiveStorageConfiguration();
  const provider = providerForConfiguration(config);
  let result: { ok: boolean; message: string; objectKey?: string };
  if (kind === "connection") result = await provider.testConnection();
  else if (kind === "upload") result = await provider.testUpload();
  else {
    const uploaded = await provider.testUpload();
    if (!uploaded.objectKey) throw new Error("Storage test upload did not return an object key.");
    result = kind === "read" ? await provider.testRead({ objectKey: uploaded.objectKey }) : await provider.testDelete({ objectKey: uploaded.objectKey });
  }
  await prisma.storageConfiguration.update({
    where: { id: config.id },
    data: { lastTestedAt: new Date(), lastTestStatus: result.ok ? "success" : "failed", lastTestMessage: safeMessage(result.message), status: result.ok && config.status === "error" ? "active" : config.status as StorageConfigurationStatus },
  }).catch(() => null);
  await createAuditEvent({ actorUserId: session.user.id, action: `storage_configuration.test_${kind}`, targetType: "storage_configuration", targetId: config.id, details: { ok: result.ok, message: safeMessage(result.message) } });
  return { ...result, message: safeMessage(result.message) };
}

function providerForConfiguration(configuration: StorageConfigurationWithSecrets): StorageProviderClient {
  if (configuration.provider === StorageProvider.local_dev) return new LocalDevStorageProvider(configuration);
  return new S3StorageProvider(configuration);
}

function withDecryptedSecrets(config: StorageConfiguration): StorageConfigurationWithSecrets {
  return {
    ...config,
    accessKeyId: config.encryptedAccessKeyId ? decryptGatewayCredential(config.encryptedAccessKeyId) : null,
    secretAccessKey: config.encryptedSecretAccessKey ? decryptGatewayCredential(config.encryptedSecretAccessKey) : null,
    sessionToken: config.encryptedSessionToken ? decryptGatewayCredential(config.encryptedSessionToken) : null,
  };
}

function localDevConfiguration(bucketName = "local-dev"): StorageConfigurationWithSecrets {
  const now = new Date();
  return {
    id: "local-dev",
    provider: "local_dev",
    displayName: "Local development storage",
    status: "active",
    bucketName,
    region: "local",
    endpoint: null,
    forcePathStyle: true,
    publicBaseUrl: null,
    encryptedAccessKeyId: null,
    encryptedSecretAccessKey: null,
    encryptedSessionToken: null,
    signedUrlExpiresInSeconds: 900,
    maxUploadSizeBytes: 10_485_760,
    allowedMimeTypesJson: DEFAULT_ALLOWED_MIME_TYPES,
    createdById: "system",
    updatedById: null,
    lastTestedAt: null,
    lastTestStatus: "not_tested",
    lastTestMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

function allowedMimeTypes(configuration: StorageConfigurationWithSecrets) {
  return Array.isArray(configuration.allowedMimeTypesJson) ? configuration.allowedMimeTypesJson.map(String) : DEFAULT_ALLOWED_MIME_TYPES;
}

function safeMessage(message: string) {
  return message.replace(/AKIA[0-9A-Z]{16}/g, "****").replace(/secret|access key/gi, "credential");
}

function maskedEncryptedPreview(encryptedValue: string) {
  try {
    return maskCredentialPreview(decryptGatewayCredential(encryptedValue));
  } catch {
    return "configured";
  }
}
