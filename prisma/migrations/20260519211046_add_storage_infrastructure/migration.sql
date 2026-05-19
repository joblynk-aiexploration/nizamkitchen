-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('aws_s3', 's3_compatible', 'local_dev');

-- CreateEnum
CREATE TYPE "StorageConfigurationStatus" AS ENUM ('draft', 'active', 'disabled', 'error');

-- CreateEnum
CREATE TYPE "StorageTestStatus" AS ENUM ('not_tested', 'success', 'failed');

-- CreateEnum
CREATE TYPE "StorageFileVisibility" AS ENUM ('private', 'organization', 'public');

-- CreateEnum
CREATE TYPE "StorageFileStatus" AS ENUM ('active', 'archived', 'deleted', 'quarantined');

-- CreateEnum
CREATE TYPE "StorageFilePurpose" AS ENUM ('user_profile_photo', 'user_cover_photo', 'business_profile_photo', 'business_cover_photo', 'recipe_image', 'menu_item_photo', 'chef_document', 'home_catering_document', 'restaurant_document', 'verification_document', 'support_attachment', 'order_attachment', 'grocery_attachment', 'general_document', 'admin_dropbox');

-- CreateEnum
CREATE TYPE "StorageModule" AS ENUM ('users', 'organizations', 'recipes', 'menus', 'home_chefs', 'home_catering', 'restaurants', 'orders', 'grocery', 'support', 'admin_dropbox', 'system');

-- CreateEnum
CREATE TYPE "StorageFileAction" AS ENUM ('uploaded', 'downloaded', 'viewed', 'signed_url_created', 'deleted', 'archived', 'restored');

-- DropIndex
DROP INDEX "StorageFile_bucket_storageKey_key";

-- Preserve existing placeholder StorageFile data while upgrading the table.
ALTER TABLE "StorageFile" RENAME COLUMN "bucket" TO "bucketName";
ALTER TABLE "StorageFile" RENAME COLUMN "contentType" TO "mimeType";
ALTER TABLE "StorageFile" RENAME COLUMN "storageKey" TO "objectKey";

ALTER TABLE "StorageFile"
ADD COLUMN     "altText" TEXT,
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "checksumSha256" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "fileExtension" TEXT,
ADD COLUMN     "imageHeight" INTEGER,
ADD COLUMN     "imageWidth" INTEGER,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "module" "StorageModule" NOT NULL DEFAULT 'system',
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "provider" "StorageProvider" NOT NULL DEFAULT 'local_dev',
ADD COLUMN     "purpose" "StorageFilePurpose" NOT NULL DEFAULT 'general_document',
ADD COLUMN     "status" "StorageFileStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "storedFilename" TEXT,
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "visibility" "StorageFileVisibility" NOT NULL DEFAULT 'private',
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "countryCode" DROP NOT NULL;

UPDATE "StorageFile"
SET
  "originalFilename" = COALESCE(NULLIF(regexp_replace("objectKey", '^.*/', ''), ''), "id"),
  "storedFilename" = COALESCE(NULLIF(regexp_replace("objectKey", '^.*/', ''), ''), "id"),
  "uploadedById" = COALESCE((SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1), "uploadedById");

ALTER TABLE "StorageFile"
ALTER COLUMN "originalFilename" SET NOT NULL,
ALTER COLUMN "storedFilename" SET NOT NULL,
ALTER COLUMN "uploadedById" SET NOT NULL,
ALTER COLUMN "module" DROP DEFAULT,
ALTER COLUMN "provider" DROP DEFAULT,
ALTER COLUMN "purpose" DROP DEFAULT;

-- CreateTable
CREATE TABLE "StorageConfiguration" (
    "id" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL DEFAULT 'aws_s3',
    "displayName" TEXT NOT NULL,
    "status" "StorageConfigurationStatus" NOT NULL DEFAULT 'draft',
    "bucketName" TEXT NOT NULL,
    "region" TEXT,
    "endpoint" TEXT,
    "forcePathStyle" BOOLEAN NOT NULL DEFAULT false,
    "publicBaseUrl" TEXT,
    "encryptedAccessKeyId" TEXT,
    "encryptedSecretAccessKey" TEXT,
    "encryptedSessionToken" TEXT,
    "signedUrlExpiresInSeconds" INTEGER NOT NULL DEFAULT 900,
    "maxUploadSizeBytes" INTEGER NOT NULL DEFAULT 10485760,
    "allowedMimeTypesJson" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" "StorageTestStatus" NOT NULL DEFAULT 'not_tested',
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageFileAccessLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "StorageFileAction" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageFileAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageFileVersion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageFileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageConfiguration_provider_idx" ON "StorageConfiguration"("provider");

-- CreateIndex
CREATE INDEX "StorageConfiguration_status_idx" ON "StorageConfiguration"("status");

-- CreateIndex
CREATE INDEX "StorageConfiguration_createdById_idx" ON "StorageConfiguration"("createdById");

-- CreateIndex
CREATE INDEX "StorageFileAccessLog_fileId_idx" ON "StorageFileAccessLog"("fileId");

-- CreateIndex
CREATE INDEX "StorageFileAccessLog_userId_idx" ON "StorageFileAccessLog"("userId");

-- CreateIndex
CREATE INDEX "StorageFileAccessLog_action_idx" ON "StorageFileAccessLog"("action");

-- CreateIndex
CREATE INDEX "StorageFileAccessLog_createdAt_idx" ON "StorageFileAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "StorageFileVersion_fileId_idx" ON "StorageFileVersion"("fileId");

-- CreateIndex
CREATE INDEX "StorageFileVersion_createdById_idx" ON "StorageFileVersion"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "StorageFileVersion_fileId_versionNumber_key" ON "StorageFileVersion"("fileId", "versionNumber");

-- CreateIndex
CREATE INDEX "StorageFile_userId_idx" ON "StorageFile"("userId");

-- CreateIndex
CREATE INDEX "StorageFile_uploadedById_idx" ON "StorageFile"("uploadedById");

-- CreateIndex
CREATE INDEX "StorageFile_module_idx" ON "StorageFile"("module");

-- CreateIndex
CREATE INDEX "StorageFile_entityType_entityId_idx" ON "StorageFile"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "StorageFile_visibility_idx" ON "StorageFile"("visibility");

-- CreateIndex
CREATE INDEX "StorageFile_status_idx" ON "StorageFile"("status");

-- CreateIndex
CREATE INDEX "StorageFile_purpose_idx" ON "StorageFile"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "StorageFile_bucketName_objectKey_key" ON "StorageFile"("bucketName", "objectKey");

-- AddForeignKey
ALTER TABLE "StorageConfiguration" ADD CONSTRAINT "StorageConfiguration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageConfiguration" ADD CONSTRAINT "StorageConfiguration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageFile" ADD CONSTRAINT "StorageFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageFileAccessLog" ADD CONSTRAINT "StorageFileAccessLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StorageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageFileAccessLog" ADD CONSTRAINT "StorageFileAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageFileVersion" ADD CONSTRAINT "StorageFileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StorageFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageFileVersion" ADD CONSTRAINT "StorageFileVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
