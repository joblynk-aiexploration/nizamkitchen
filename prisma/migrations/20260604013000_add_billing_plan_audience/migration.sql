CREATE TYPE "BillingPlanAudience" AS ENUM (
  'household',
  'chef_staff',
  'home_catering',
  'restaurant',
  'platform_internal'
);

ALTER TABLE "BillingPlan"
  ADD COLUMN "planAudience" "BillingPlanAudience" NOT NULL DEFAULT 'household';

UPDATE "BillingPlan"
SET "planAudience" = CASE
  WHEN "slug" IN ('chef-business', 'home-chef-basic') THEN 'chef_staff'::"BillingPlanAudience"
  WHEN "slug" IN ('home-catering-seller', 'catering-starter', 'catering-pro') THEN 'home_catering'::"BillingPlanAudience"
  WHEN "slug" IN ('restaurant-partner') THEN 'restaurant'::"BillingPlanAudience"
  WHEN "slug" IN ('enterprise', 'enterprise-internal') THEN 'platform_internal'::"BillingPlanAudience"
  ELSE 'household'::"BillingPlanAudience"
END;

UPDATE "BillingPlan"
SET "status" = 'archived',
    "stripePriceId" = NULL
WHERE "slug" IN ('premium-household', 'chef-business', 'home-catering-seller', 'enterprise');

CREATE INDEX "BillingPlan_planAudience_idx" ON "BillingPlan"("planAudience");
