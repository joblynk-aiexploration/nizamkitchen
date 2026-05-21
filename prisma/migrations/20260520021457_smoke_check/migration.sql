-- Align profile upload reference indexes with the current Prisma schema.
-- These fields remain available for S3-backed uploads, but the schema no longer
-- declares separate lookup indexes for them.
DROP INDEX IF EXISTS "ChefProfile_coverPhotoFileId_idx";
DROP INDEX IF EXISTS "ChefProfile_profilePhotoFileId_idx";
DROP INDEX IF EXISTS "HomeCateringProfile_coverPhotoFileId_idx";
DROP INDEX IF EXISTS "HomeCateringProfile_profilePhotoFileId_idx";
DROP INDEX IF EXISTS "MenuItem_photoFileId_idx";
DROP INDEX IF EXISTS "Organization_coverPhotoFileId_idx";
DROP INDEX IF EXISTS "Organization_logoFileId_idx";
DROP INDEX IF EXISTS "User_coverPhotoFileId_idx";
DROP INDEX IF EXISTS "User_profilePhotoFileId_idx";
DROP INDEX IF EXISTS "User_publicProfileEnabled_idx";
