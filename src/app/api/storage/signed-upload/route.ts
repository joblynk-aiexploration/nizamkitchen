import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireMembership } from "@/lib/auth/session";
import { DEFAULT_ALLOWED_MIME_TYPES, storageUploadSchema, validateFileInput } from "@/server/storage/file-validation";
import { buildStorageObjectKey } from "@/server/storage/storage-keys";
import { getStorageProvider } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireMembership();
  const body = await request.json().catch(() => null);
  try {
    const parsed = storageUploadSchema.parse(body);
    const { configuration, provider } = await getStorageProvider();
    if (!provider.getSignedUploadUrl) return NextResponse.json({ error: "Signed upload is not supported by this provider." }, { status: 400 });
    const validation = validateFileInput({
      filename: body.filename,
      mimeType: body.mimeType,
      sizeBytes: Number(body.sizeBytes),
      maxUploadSizeBytes: configuration.maxUploadSizeBytes,
      allowedMimeTypes: Array.isArray(configuration.allowedMimeTypesJson) ? configuration.allowedMimeTypesJson.map(String) : DEFAULT_ALLOWED_MIME_TYPES,
    });
    const fileId = crypto.randomUUID();
    const objectKey = buildStorageObjectKey({
      countryCode: session.activeOrganization?.countryCode,
      organizationId: session.activeOrganization?.id,
      module: parsed.module,
      entityType: parsed.entityType || null,
      entityId: parsed.entityId || null,
      purpose: parsed.purpose,
      fileId,
      originalFilename: body.filename,
    });
    const url = await provider.getSignedUploadUrl({ objectKey, mimeType: validation.mimeType, expiresInSeconds: configuration.signedUrlExpiresInSeconds });
    return NextResponse.json({ fileId, objectKey, url, expiresInSeconds: configuration.signedUrlExpiresInSeconds });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create signed upload URL." }, { status: 400 });
  }
}
