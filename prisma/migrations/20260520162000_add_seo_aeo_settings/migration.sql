-- CreateEnum
CREATE TYPE "SeoScope" AS ENUM ('global', 'page', 'recipe', 'seller_profile', 'city_page', 'country_page', 'menu_template', 'custom_path');

-- CreateEnum
CREATE TYPE "RobotsDirective" AS ENUM ('index_follow', 'noindex_follow', 'noindex_nofollow', 'index_nofollow');

-- CreateTable
CREATE TABLE "SeoSetting" (
  "id" TEXT NOT NULL,
  "scope" "SeoScope" NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "countryCode" TEXT,
  "city" TEXT,
  "path" TEXT,
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "canonicalUrl" TEXT,
  "ogTitle" TEXT,
  "ogDescription" TEXT,
  "ogImageFileId" TEXT,
  "twitterTitle" TEXT,
  "twitterDescription" TEXT,
  "twitterImageFileId" TEXT,
  "robotsDirective" "RobotsDirective",
  "structuredDataJson" JSONB,
  "aeoSummary" TEXT,
  "aeoFaqJson" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeoSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoSetting_scope_idx" ON "SeoSetting"("scope");
CREATE INDEX "SeoSetting_entityType_entityId_idx" ON "SeoSetting"("entityType", "entityId");
CREATE INDEX "SeoSetting_countryCode_idx" ON "SeoSetting"("countryCode");
CREATE INDEX "SeoSetting_city_idx" ON "SeoSetting"("city");
CREATE INDEX "SeoSetting_path_idx" ON "SeoSetting"("path");
CREATE INDEX "SeoSetting_isActive_idx" ON "SeoSetting"("isActive");
CREATE INDEX "SeoSetting_createdById_idx" ON "SeoSetting"("createdById");

-- AddForeignKey
ALTER TABLE "SeoSetting" ADD CONSTRAINT "SeoSetting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeoSetting" ADD CONSTRAINT "SeoSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
