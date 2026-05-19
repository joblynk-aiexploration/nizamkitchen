-- CreateEnum
CREATE TYPE "BusinessProfileType" AS ENUM ('home_catering', 'chef_business', 'restaurant');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('instagram', 'facebook', 'tiktok', 'youtube', 'whatsapp', 'website', 'x', 'snapchat', 'other');

-- CreateTable
CREATE TABLE "BusinessSocialLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profileType" "BusinessProfileType" NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessSocialLink_organizationId_idx" ON "BusinessSocialLink"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessSocialLink_profileType_idx" ON "BusinessSocialLink"("profileType");

-- CreateIndex
CREATE INDEX "BusinessSocialLink_platform_idx" ON "BusinessSocialLink"("platform");

-- CreateIndex
CREATE INDEX "BusinessSocialLink_isPublic_idx" ON "BusinessSocialLink"("isPublic");

-- CreateIndex
CREATE INDEX "BusinessSocialLink_displayOrder_idx" ON "BusinessSocialLink"("displayOrder");

-- AddForeignKey
ALTER TABLE "BusinessSocialLink" ADD CONSTRAINT "BusinessSocialLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
