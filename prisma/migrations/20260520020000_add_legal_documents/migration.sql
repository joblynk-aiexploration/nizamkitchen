-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('terms_of_service', 'privacy_policy', 'seller_agreement', 'home_chef_agreement', 'home_catering_agreement', 'restaurant_partner_agreement', 'refund_policy', 'cancellation_policy', 'food_safety_policy', 'background_check_consent', 'file_upload_policy', 'marketplace_disclaimer', 'other');

-- CreateEnum
CREATE TYPE "LegalDocumentStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LegalAudience" AS ENUM ('all_users', 'households', 'chefs', 'home_catering', 'restaurants', 'admins', 'sellers');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('accepted', 'revoked', 'declined');

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "documentType" "LegalDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "LegalDocumentStatus" NOT NULL DEFAULT 'draft',
    "countryCode" TEXT,
    "region" TEXT,
    "audience" "LegalAudience" NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentAcceptance" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "acceptedVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalConsentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "consentType" "LegalDocumentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL,
    "textSnapshot" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_slug_version_countryCode_region_key" ON "LegalDocument"("slug", "version", "countryCode", "region");
CREATE INDEX "LegalDocument_documentType_idx" ON "LegalDocument"("documentType");
CREATE INDEX "LegalDocument_slug_idx" ON "LegalDocument"("slug");
CREATE INDEX "LegalDocument_status_idx" ON "LegalDocument"("status");
CREATE INDEX "LegalDocument_audience_idx" ON "LegalDocument"("audience");
CREATE INDEX "LegalDocument_countryCode_idx" ON "LegalDocument"("countryCode");
CREATE INDEX "LegalDocument_region_idx" ON "LegalDocument"("region");
CREATE INDEX "LegalDocument_effectiveAt_idx" ON "LegalDocument"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentAcceptance_documentId_userId_organizationId_key" ON "LegalDocumentAcceptance"("documentId", "userId", "organizationId");
CREATE INDEX "LegalDocumentAcceptance_userId_idx" ON "LegalDocumentAcceptance"("userId");
CREATE INDEX "LegalDocumentAcceptance_organizationId_idx" ON "LegalDocumentAcceptance"("organizationId");
CREATE INDEX "LegalDocumentAcceptance_acceptedVersion_idx" ON "LegalDocumentAcceptance"("acceptedVersion");
CREATE INDEX "LegalDocumentAcceptance_acceptedAt_idx" ON "LegalDocumentAcceptance"("acceptedAt");

-- CreateIndex
CREATE INDEX "LegalConsentEvent_userId_idx" ON "LegalConsentEvent"("userId");
CREATE INDEX "LegalConsentEvent_organizationId_idx" ON "LegalConsentEvent"("organizationId");
CREATE INDEX "LegalConsentEvent_consentType_idx" ON "LegalConsentEvent"("consentType");
CREATE INDEX "LegalConsentEvent_status_idx" ON "LegalConsentEvent"("status");
CREATE INDEX "LegalConsentEvent_createdAt_idx" ON "LegalConsentEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentAcceptance" ADD CONSTRAINT "LegalDocumentAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentAcceptance" ADD CONSTRAINT "LegalDocumentAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentAcceptance" ADD CONSTRAINT "LegalDocumentAcceptance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalConsentEvent" ADD CONSTRAINT "LegalConsentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalConsentEvent" ADD CONSTRAINT "LegalConsentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
