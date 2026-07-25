CREATE TYPE "HomeChefRevealTrigger" AS ENUM (
  'never',
  'offer_created',
  'chef_accepted',
  'household_confirmed',
  'deposit_authorized',
  'deposit_paid',
  'full_payment_paid',
  'admin_confirmed',
  'booking_locked',
  'within_24_hours',
  'completed'
);

CREATE TYPE "HomeChefPrivacyPolicyStatus" AS ENUM ('active', 'disabled');

CREATE TYPE "HomeChefBookingLockStatus" AS ENUM (
  'not_locked',
  'pending_household_confirmation',
  'pending_payment',
  'deposit_authorized',
  'deposit_paid',
  'full_payment_paid',
  'admin_confirmed',
  'locked',
  'unlocked_cancelled',
  'revoked'
);

CREATE TYPE "HomeChefAccessGrantType" AS ENUM (
  'limited_request_view',
  'anonymous_messaging',
  'full_logistics',
  'address_access',
  'contact_proxy',
  'emergency_contact'
);

CREATE TYPE "HomeChefAccessGrantStatus" AS ENUM ('active', 'expired', 'revoked');

CREATE TYPE "ContactProxyStatus" AS ENUM ('pending', 'active', 'expired', 'revoked');

CREATE TYPE "ContactProxyProvider" AS ENUM ('manual_placeholder', 'twilio_placeholder', 'other');

ALTER TABLE "HomeChefRequest"
  ADD COLUMN "bookingLockStatus" "HomeChefBookingLockStatus" NOT NULL DEFAULT 'not_locked',
  ADD COLUMN "bookingLockedAt" TIMESTAMP(3),
  ADD COLUMN "bookingLockedById" TEXT,
  ADD COLUMN "bookingLockReason" TEXT,
  ADD COLUMN "addressRevealedAt" TIMESTAMP(3),
  ADD COLUMN "addressAccessRevokedAt" TIMESTAMP(3),
  ADD COLUMN "contactAccessRevokedAt" TIMESTAMP(3);

CREATE TABLE "HomeChefPrivacyPolicy" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT,
  "region" TEXT,
  "city" TEXT,
  "requestType" "HomeChefRequestType",
  "revealExactAddressTrigger" "HomeChefRevealTrigger" NOT NULL DEFAULT 'booking_locked',
  "revealCustomerNameTrigger" "HomeChefRevealTrigger" NOT NULL DEFAULT 'booking_locked',
  "allowPreAcceptanceMessaging" BOOLEAN NOT NULL DEFAULT true,
  "allowFirstNameBeforeAcceptance" BOOLEAN NOT NULL DEFAULT false,
  "allowPhoneProxyAfterLock" BOOLEAN NOT NULL DEFAULT true,
  "allowRealPhoneReveal" BOOLEAN NOT NULL DEFAULT false,
  "allowEmailReveal" BOOLEAN NOT NULL DEFAULT false,
  "revokeAccessOnCancellation" BOOLEAN NOT NULL DEFAULT true,
  "revokeAccessAfterCompletionDays" INTEGER,
  "emergencyContactWindowHours" INTEGER NOT NULL DEFAULT 24,
  "status" "HomeChefPrivacyPolicyStatus" NOT NULL DEFAULT 'active',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeChefPrivacyPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeChefRequestAccessGrant" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "chefProfileId" TEXT NOT NULL,
  "userId" TEXT,
  "grantType" "HomeChefAccessGrantType" NOT NULL,
  "status" "HomeChefAccessGrantStatus" NOT NULL DEFAULT 'active',
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeChefRequestAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactProxySession" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "householdUserId" TEXT NOT NULL,
  "chefProfileId" TEXT NOT NULL,
  "status" "ContactProxyStatus" NOT NULL DEFAULT 'pending',
  "provider" "ContactProxyProvider" NOT NULL DEFAULT 'manual_placeholder',
  "proxyNumber" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactProxySession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeChefRequest_bookingLockStatus_idx" ON "HomeChefRequest"("bookingLockStatus");
CREATE INDEX "HomeChefRequest_bookingLockedById_idx" ON "HomeChefRequest"("bookingLockedById");

CREATE INDEX "HomeChefPrivacyPolicy_countryCode_idx" ON "HomeChefPrivacyPolicy"("countryCode");
CREATE INDEX "HomeChefPrivacyPolicy_region_idx" ON "HomeChefPrivacyPolicy"("region");
CREATE INDEX "HomeChefPrivacyPolicy_city_idx" ON "HomeChefPrivacyPolicy"("city");
CREATE INDEX "HomeChefPrivacyPolicy_requestType_idx" ON "HomeChefPrivacyPolicy"("requestType");
CREATE INDEX "HomeChefPrivacyPolicy_status_idx" ON "HomeChefPrivacyPolicy"("status");

CREATE INDEX "HomeChefRequestAccessGrant_requestId_idx" ON "HomeChefRequestAccessGrant"("requestId");
CREATE INDEX "HomeChefRequestAccessGrant_chefProfileId_idx" ON "HomeChefRequestAccessGrant"("chefProfileId");
CREATE INDEX "HomeChefRequestAccessGrant_userId_idx" ON "HomeChefRequestAccessGrant"("userId");
CREATE INDEX "HomeChefRequestAccessGrant_createdById_idx" ON "HomeChefRequestAccessGrant"("createdById");
CREATE INDEX "HomeChefRequestAccessGrant_grantType_idx" ON "HomeChefRequestAccessGrant"("grantType");
CREATE INDEX "HomeChefRequestAccessGrant_status_idx" ON "HomeChefRequestAccessGrant"("status");
CREATE INDEX "HomeChefRequestAccessGrant_expiresAt_idx" ON "HomeChefRequestAccessGrant"("expiresAt");

CREATE INDEX "ContactProxySession_requestId_idx" ON "ContactProxySession"("requestId");
CREATE INDEX "ContactProxySession_householdUserId_idx" ON "ContactProxySession"("householdUserId");
CREATE INDEX "ContactProxySession_chefProfileId_idx" ON "ContactProxySession"("chefProfileId");
CREATE INDEX "ContactProxySession_status_idx" ON "ContactProxySession"("status");
CREATE INDEX "ContactProxySession_expiresAt_idx" ON "ContactProxySession"("expiresAt");

ALTER TABLE "HomeChefRequest" ADD CONSTRAINT "HomeChefRequest_bookingLockedById_fkey" FOREIGN KEY ("bookingLockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeChefPrivacyPolicy" ADD CONSTRAINT "HomeChefPrivacyPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeChefPrivacyPolicy" ADD CONSTRAINT "HomeChefPrivacyPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequestAccessGrant" ADD CONSTRAINT "HomeChefRequestAccessGrant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HomeChefRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequestAccessGrant" ADD CONSTRAINT "HomeChefRequestAccessGrant_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequestAccessGrant" ADD CONSTRAINT "HomeChefRequestAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeChefRequestAccessGrant" ADD CONSTRAINT "HomeChefRequestAccessGrant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactProxySession" ADD CONSTRAINT "ContactProxySession_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HomeChefRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactProxySession" ADD CONSTRAINT "ContactProxySession_householdUserId_fkey" FOREIGN KEY ("householdUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactProxySession" ADD CONSTRAINT "ContactProxySession_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
