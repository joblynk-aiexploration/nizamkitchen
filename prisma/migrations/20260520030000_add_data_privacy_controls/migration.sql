-- AlterEnum
ALTER TYPE "StorageFilePurpose" ADD VALUE IF NOT EXISTS 'data_export';

-- AlterEnum
ALTER TYPE "StorageModule" ADD VALUE IF NOT EXISTS 'privacy';

-- CreateEnum
CREATE TYPE "DataPrivacyRequestType" AS ENUM ('user_export', 'organization_export', 'account_deletion', 'organization_deletion', 'anonymization', 'file_deletion', 'correction_request');

-- CreateEnum
CREATE TYPE "DataPrivacyRequestStatus" AS ENUM ('submitted', 'reviewing', 'processing', 'completed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "DataCategory" AS ENUM ('user_profile', 'organization_profile', 'orders', 'payments', 'files', 'kyc_documents', 'support_tickets', 'audit_logs', 'notifications', 'marketing', 'marketplace_profiles');

-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('retain', 'archive', 'anonymize', 'delete');

-- CreateEnum
CREATE TYPE "DataRetentionPolicyStatus" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "DataPrivacyRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestType" "DataPrivacyRequestType" NOT NULL,
    "status" "DataPrivacyRequestStatus" NOT NULL DEFAULT 'submitted',
    "countryCode" TEXT,
    "reason" TEXT,
    "adminNotes" TEXT,
    "exportFileId" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataPrivacyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT,
    "dataCategory" "DataCategory" NOT NULL,
    "retentionDays" INTEGER,
    "action" "RetentionAction" NOT NULL,
    "status" "DataRetentionPolicyStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataPrivacyRequest_userId_idx" ON "DataPrivacyRequest"("userId");
CREATE INDEX "DataPrivacyRequest_organizationId_idx" ON "DataPrivacyRequest"("organizationId");
CREATE INDEX "DataPrivacyRequest_requestedById_idx" ON "DataPrivacyRequest"("requestedById");
CREATE INDEX "DataPrivacyRequest_requestType_idx" ON "DataPrivacyRequest"("requestType");
CREATE INDEX "DataPrivacyRequest_status_idx" ON "DataPrivacyRequest"("status");
CREATE INDEX "DataPrivacyRequest_countryCode_idx" ON "DataPrivacyRequest"("countryCode");
CREATE INDEX "DataPrivacyRequest_exportFileId_idx" ON "DataPrivacyRequest"("exportFileId");
CREATE INDEX "DataPrivacyRequest_createdAt_idx" ON "DataPrivacyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "DataRetentionPolicy_countryCode_idx" ON "DataRetentionPolicy"("countryCode");
CREATE INDEX "DataRetentionPolicy_dataCategory_idx" ON "DataRetentionPolicy"("dataCategory");
CREATE INDEX "DataRetentionPolicy_status_idx" ON "DataRetentionPolicy"("status");
CREATE INDEX "DataRetentionPolicy_createdById_idx" ON "DataRetentionPolicy"("createdById");
CREATE INDEX "DataRetentionPolicy_updatedById_idx" ON "DataRetentionPolicy"("updatedById");

-- AddForeignKey
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataPrivacyRequest" ADD CONSTRAINT "DataPrivacyRequest_exportFileId_fkey" FOREIGN KEY ("exportFileId") REFERENCES "StorageFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
