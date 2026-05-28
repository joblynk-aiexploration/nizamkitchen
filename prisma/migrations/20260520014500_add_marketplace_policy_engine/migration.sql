-- CreateEnum
CREATE TYPE "MarketplacePolicyStatus" AS ENUM ('draft', 'active', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "MarketplacePolicyModule" AS ENUM ('seller_verification', 'menu_publishing', 'food_orders', 'home_chef_requests', 'payments', 'payouts', 'public_profiles', 'refunds', 'cancellations', 'storage', 'support', 'general');

-- CreateEnum
CREATE TYPE "MarketplacePolicyResult" AS ENUM ('allowed', 'denied', 'warning', 'needs_review');

-- CreateEnum
CREATE TYPE "PolicyOverrideStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "MarketplacePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "sellerType" "SellerType",
    "organizationType" "OrganizationType",
    "module" "MarketplacePolicyModule" NOT NULL,
    "status" "MarketplacePolicyStatus" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "rulesJson" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePolicyOverride" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "PolicyOverrideStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePolicyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePolicyEvaluationLog" (
    "id" TEXT NOT NULL,
    "policyId" TEXT,
    "organizationId" TEXT,
    "userId" TEXT,
    "module" "MarketplacePolicyModule" NOT NULL,
    "action" TEXT NOT NULL,
    "result" "MarketplacePolicyResult" NOT NULL,
    "reason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePolicyEvaluationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplacePolicy_countryCode_idx" ON "MarketplacePolicy"("countryCode");
CREATE INDEX "MarketplacePolicy_region_idx" ON "MarketplacePolicy"("region");
CREATE INDEX "MarketplacePolicy_sellerType_idx" ON "MarketplacePolicy"("sellerType");
CREATE INDEX "MarketplacePolicy_organizationType_idx" ON "MarketplacePolicy"("organizationType");
CREATE INDEX "MarketplacePolicy_module_idx" ON "MarketplacePolicy"("module");
CREATE INDEX "MarketplacePolicy_status_idx" ON "MarketplacePolicy"("status");
CREATE INDEX "MarketplacePolicy_priority_idx" ON "MarketplacePolicy"("priority");

-- CreateIndex
CREATE INDEX "MarketplacePolicyOverride_policyId_idx" ON "MarketplacePolicyOverride"("policyId");
CREATE INDEX "MarketplacePolicyOverride_organizationId_idx" ON "MarketplacePolicyOverride"("organizationId");
CREATE INDEX "MarketplacePolicyOverride_userId_idx" ON "MarketplacePolicyOverride"("userId");
CREATE INDEX "MarketplacePolicyOverride_status_idx" ON "MarketplacePolicyOverride"("status");
CREATE INDEX "MarketplacePolicyOverride_expiresAt_idx" ON "MarketplacePolicyOverride"("expiresAt");

-- CreateIndex
CREATE INDEX "MarketplacePolicyEvaluationLog_policyId_idx" ON "MarketplacePolicyEvaluationLog"("policyId");
CREATE INDEX "MarketplacePolicyEvaluationLog_organizationId_idx" ON "MarketplacePolicyEvaluationLog"("organizationId");
CREATE INDEX "MarketplacePolicyEvaluationLog_userId_idx" ON "MarketplacePolicyEvaluationLog"("userId");
CREATE INDEX "MarketplacePolicyEvaluationLog_module_idx" ON "MarketplacePolicyEvaluationLog"("module");
CREATE INDEX "MarketplacePolicyEvaluationLog_action_idx" ON "MarketplacePolicyEvaluationLog"("action");
CREATE INDEX "MarketplacePolicyEvaluationLog_result_idx" ON "MarketplacePolicyEvaluationLog"("result");
CREATE INDEX "MarketplacePolicyEvaluationLog_createdAt_idx" ON "MarketplacePolicyEvaluationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketplacePolicy" ADD CONSTRAINT "MarketplacePolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicy" ADD CONSTRAINT "MarketplacePolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyOverride" ADD CONSTRAINT "MarketplacePolicyOverride_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "MarketplacePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyOverride" ADD CONSTRAINT "MarketplacePolicyOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyOverride" ADD CONSTRAINT "MarketplacePolicyOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyOverride" ADD CONSTRAINT "MarketplacePolicyOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyOverride" ADD CONSTRAINT "MarketplacePolicyOverride_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyEvaluationLog" ADD CONSTRAINT "MarketplacePolicyEvaluationLog_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "MarketplacePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyEvaluationLog" ADD CONSTRAINT "MarketplacePolicyEvaluationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplacePolicyEvaluationLog" ADD CONSTRAINT "MarketplacePolicyEvaluationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
