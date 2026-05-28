import { prisma } from "@/lib/prisma";
import type { StorageSession } from "@/server/storage/storage-permissions";
import { getStorageFileUrl } from "@/server/storage/storage-service";

export async function getStorageImageUrl(session: StorageSession, fileId?: string | null, fallbackUrl?: string | null) {
  if (!fileId) return fallbackUrl ?? null;
  try {
    const signed = await getStorageFileUrl(session, fileId);
    return signed.url;
  } catch {
    return fallbackUrl ?? null;
  }
}

export async function resolveStorageImageUrls<T extends { id: string }>(
  session: StorageSession,
  items: T[],
  getFileId: (item: T) => string | null | undefined,
  getFallback?: (item: T) => string | null | undefined,
) {
  const entries = await Promise.all(
    items.map(async (item) => [item.id, await getStorageImageUrl(session, getFileId(item), getFallback?.(item))] as const),
  );
  return Object.fromEntries(entries) as Record<string, string | null>;
}

export async function assertStorageFileBelongsToOrganization(fileId: string | null | undefined, organizationId: string) {
  if (!fileId) return null;
  const file = await prisma.storageFile.findFirst({
    where: { id: fileId, organizationId, status: "active" },
    select: { id: true, purpose: true, module: true },
  });
  if (!file) throw new Error("Uploaded file was not found for this organization.");
  return file;
}

export async function assertStorageFileBelongsToUser(fileId: string | null | undefined, userId: string) {
  if (!fileId) return null;
  const file = await prisma.storageFile.findFirst({
    where: { id: fileId, uploadedById: userId, status: "active" },
    select: { id: true, purpose: true, module: true },
  });
  if (!file) throw new Error("Uploaded file was not found for this user.");
  return file;
}
