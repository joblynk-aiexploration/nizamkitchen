import { env } from "@/lib/env";
import { sanitizeFilename } from "@/server/storage/file-validation";

export function buildStorageObjectKey(input: {
  countryCode?: string | null;
  organizationId?: string | null;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  purpose: string;
  fileId: string;
  originalFilename: string;
}) {
  const environment = safeSegment(env.DEPLOYMENT_ENVIRONMENT || env.NODE_ENV || "local");
  const country = safeSegment(input.countryCode ?? "system");
  const organization = safeSegment(input.organizationId ?? "system");
  const moduleSegment = safeSegment(input.module);
  const entityType = safeSegment(input.entityType ?? "general");
  const entityId = safeSegment(input.entityId ?? input.fileId);
  const purpose = safeSegment(input.purpose);
  const safeFilename = sanitizeFilename(input.originalFilename);
  return ["nizamkitchen", environment, country, organization, moduleSegment, entityType, entityId, purpose, `${input.fileId}-${safeFilename}`].join("/");
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 96) || "unknown";
}
