-- CreateEnum
CREATE TYPE "SellerVerificationPolicyStatus" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "SellerVerificationPolicy" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT,
    "region" TEXT,
    "sellerType" "SellerType" NOT NULL,
    "policyName" TEXT NOT NULL,
    "status" "SellerVerificationPolicyStatus" NOT NULL DEFAULT 'active',
    "allowPublicProfileBeforeVerification" BOOLEAN NOT NULL DEFAULT false,
    "allowMenuPublishingBeforeVerification" BOOLEAN NOT NULL DEFAULT false,
    "allowOrderAcceptanceBeforeVerification" BOOLEAN NOT NULL DEFAULT false,
    "allowPayoutsBeforeVerification" BOOLEAN NOT NULL DEFAULT false,
    "requireIdentityVerification" BOOLEAN NOT NULL DEFAULT false,
    "requireFoodHandlerCertificate" BOOLEAN NOT NULL DEFAULT false,
    "requireLocalPermit" BOOLEAN NOT NULL DEFAULT false,
    "requireKitchenReview" BOOLEAN NOT NULL DEFAULT false,
    "requireBackgroundCheck" BOOLEAN NOT NULL DEFAULT false,
    "requirePayoutOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "requireAdminApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerVerificationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerVerificationOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT,
    "grantedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerVerificationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerVerificationPolicy_countryCode_idx" ON "SellerVerificationPolicy"("countryCode");

-- CreateIndex
CREATE INDEX "SellerVerificationPolicy_region_idx" ON "SellerVerificationPolicy"("region");

-- CreateIndex
CREATE INDEX "SellerVerificationPolicy_sellerType_idx" ON "SellerVerificationPolicy"("sellerType");

-- CreateIndex
CREATE INDEX "SellerVerificationPolicy_status_idx" ON "SellerVerificationPolicy"("status");

-- CreateIndex
CREATE INDEX "SellerVerificationOverride_organizationId_idx" ON "SellerVerificationOverride"("organizationId");

-- CreateIndex
CREATE INDEX "SellerVerificationOverride_policyId_idx" ON "SellerVerificationOverride"("policyId");

-- CreateIndex
CREATE INDEX "SellerVerificationOverride_grantedById_idx" ON "SellerVerificationOverride"("grantedById");

-- CreateIndex
CREATE INDEX "SellerVerificationOverride_expiresAt_idx" ON "SellerVerificationOverride"("expiresAt");

-- CreateIndex
CREATE INDEX "SellerVerificationOverride_revokedAt_idx" ON "SellerVerificationOverride"("revokedAt");

-- AddForeignKey
ALTER TABLE "SellerVerificationOverride" ADD CONSTRAINT "SellerVerificationOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerVerificationOverride" ADD CONSTRAINT "SellerVerificationOverride_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SellerVerificationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerVerificationOverride" ADD CONSTRAINT "SellerVerificationOverride_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
