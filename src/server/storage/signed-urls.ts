import type { StorageFile } from "@prisma/client";
import type { StorageSession } from "@/server/storage/storage-permissions";
import { canAccessStorageFile } from "@/server/storage/storage-permissions";
import { getStorageProviderForFile } from "@/server/storage/storage-service";

export async function createSignedReadUrl(session: StorageSession, file: StorageFile, options?: { ipAddress?: string | null; userAgent?: string | null }) {
  if (!canAccessStorageFile(session, file)) throw new Error("You do not have permission to access this file.");
  const { provider, configuration } = await getStorageProviderForFile(file);
  const url = file.visibility === "public" && configuration.publicBaseUrl
    ? `${configuration.publicBaseUrl.replace(/\/$/, "")}/${file.objectKey}`
    : await provider.getSignedReadUrl({ objectKey: file.objectKey, expiresInSeconds: configuration.signedUrlExpiresInSeconds, file });
  return { url, expiresInSeconds: configuration.signedUrlExpiresInSeconds, ipAddress: options?.ipAddress ?? null, userAgent: options?.userAgent ?? null };
}
