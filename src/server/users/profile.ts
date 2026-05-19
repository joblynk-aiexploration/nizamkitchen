import { prisma } from "@/lib/prisma";
import { userProfileSchema } from "@/lib/validation/user-profile";
import { createAuditEvent } from "@/server/audit";
import { assertStorageFileBelongsToUser } from "@/server/storage/storage-images";

export async function updateUserProfile(params: { userId: string; input: unknown }) {
  const parsed = userProfileSchema.parse(params.input);
  await Promise.all([
    assertStorageFileBelongsToUser(parsed.profilePhotoFileId, params.userId),
    assertStorageFileBelongsToUser(parsed.coverPhotoFileId, params.userId),
  ]);

  const user = await prisma.user.update({
    where: { id: params.userId },
    data: {
      fullName: parsed.fullName,
      profilePhotoFileId: parsed.profilePhotoFileId ?? null,
      coverPhotoFileId: parsed.coverPhotoFileId ?? null,
      headline: parsed.headline ?? null,
      bio: parsed.bio ?? null,
      location: parsed.location ?? null,
    },
  });

  await createAuditEvent({
    actorUserId: params.userId,
    action: "profile_photo.uploaded",
    targetType: "user",
    targetId: user.id,
    details: { profilePhotoFileId: user.profilePhotoFileId, coverPhotoFileId: user.coverPhotoFileId },
  });

  return user;
}
