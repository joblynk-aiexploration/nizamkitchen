-- Add S3 StorageFile reference fields while preserving existing URL fallback columns.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profilePhotoFileId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coverPhotoFileId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "headline" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "location" TEXT;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logoFileId" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "coverPhotoFileId" TEXT;

ALTER TABLE "ChefProfile" ADD COLUMN IF NOT EXISTS "profilePhotoFileId" TEXT;
ALTER TABLE "ChefProfile" ADD COLUMN IF NOT EXISTS "coverPhotoFileId" TEXT;

ALTER TABLE "HomeCateringProfile" ADD COLUMN IF NOT EXISTS "profilePhotoFileId" TEXT;
ALTER TABLE "HomeCateringProfile" ADD COLUMN IF NOT EXISTS "coverPhotoFileId" TEXT;

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "photoFileId" TEXT;

CREATE INDEX IF NOT EXISTS "User_profilePhotoFileId_idx" ON "User"("profilePhotoFileId");
CREATE INDEX IF NOT EXISTS "User_coverPhotoFileId_idx" ON "User"("coverPhotoFileId");
CREATE INDEX IF NOT EXISTS "Organization_logoFileId_idx" ON "Organization"("logoFileId");
CREATE INDEX IF NOT EXISTS "Organization_coverPhotoFileId_idx" ON "Organization"("coverPhotoFileId");
CREATE INDEX IF NOT EXISTS "ChefProfile_profilePhotoFileId_idx" ON "ChefProfile"("profilePhotoFileId");
CREATE INDEX IF NOT EXISTS "ChefProfile_coverPhotoFileId_idx" ON "ChefProfile"("coverPhotoFileId");
CREATE INDEX IF NOT EXISTS "HomeCateringProfile_profilePhotoFileId_idx" ON "HomeCateringProfile"("profilePhotoFileId");
CREATE INDEX IF NOT EXISTS "HomeCateringProfile_coverPhotoFileId_idx" ON "HomeCateringProfile"("coverPhotoFileId");
CREATE INDEX IF NOT EXISTS "MenuItem_photoFileId_idx" ON "MenuItem"("photoFileId");
