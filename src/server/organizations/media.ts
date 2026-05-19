import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { assertStorageFileBelongsToOrganization } from "@/server/storage/storage-images";

export async function updateOrganizationMedia(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  logoFileId?: string | null;
  coverPhotoFileId?: string | null;
}) {
  await Promise.all([
    assertStorageFileBelongsToOrganization(params.logoFileId, params.organizationId),
    assertStorageFileBelongsToOrganization(params.coverPhotoFileId, params.organizationId),
  ]);

  const organization = await prisma.organization.update({
    where: { id: params.organizationId },
    data: {
      logoFileId: params.logoFileId || null,
      coverPhotoFileId: params.coverPhotoFileId || null,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "business_photo.uploaded",
    targetType: "organization",
    targetId: organization.id,
    details: { logoFileId: organization.logoFileId, coverPhotoFileId: organization.coverPhotoFileId },
  });

  return organization;
}
