ALTER TABLE "BillingPlan" ADD COLUMN "isPopular" BOOLEAN NOT NULL DEFAULT false;

UPDATE "BillingPlan"
SET "isPopular" = true
WHERE "slug" IN ('family-plus', 'home-chef-plus', 'catering-pro', 'restaurant-growth');
