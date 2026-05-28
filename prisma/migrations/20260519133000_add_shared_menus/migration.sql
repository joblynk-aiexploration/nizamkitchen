-- CreateEnum
CREATE TYPE "MenuStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "MenuVisibility" AS ENUM ('private', 'public');

-- CreateEnum
CREATE TYPE "MenuItemStatus" AS ENUM ('draft', 'active', 'sold_out', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "MenuItemCategory" AS ENUM ('biryani', 'curry', 'salan', 'rice', 'bread', 'snack', 'dessert', 'drink', 'combo', 'catering_tray', 'special', 'other');

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MenuStatus" NOT NULL DEFAULT 'draft',
    "visibility" "MenuVisibility" NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "menuId" TEXT,
    "countryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cuisine" TEXT,
    "category" "MenuItemCategory" NOT NULL,
    "priceAmount" DOUBLE PRECISION,
    "currencyCode" TEXT NOT NULL,
    "servingSize" TEXT,
    "spiceLevel" "SpiceLevel",
    "preparationTimeMinutes" INTEGER,
    "minimumOrderQuantity" INTEGER,
    "maxDailyQuantity" INTEGER,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "preorderRequired" BOOLEAN NOT NULL DEFAULT false,
    "minimumNoticeHours" INTEGER,
    "pickupAvailable" BOOLEAN NOT NULL DEFAULT true,
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "allergensJson" JSONB,
    "ingredientsSummary" TEXT,
    "status" "MenuItemStatus" NOT NULL DEFAULT 'draft',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemAvailability" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Menu_organizationId_idx" ON "Menu"("organizationId");
CREATE INDEX "Menu_countryCode_idx" ON "Menu"("countryCode");
CREATE INDEX "Menu_status_idx" ON "Menu"("status");
CREATE INDEX "Menu_visibility_idx" ON "Menu"("visibility");
CREATE UNIQUE INDEX "MenuItem_organizationId_slug_key" ON "MenuItem"("organizationId", "slug");
CREATE INDEX "MenuItem_organizationId_idx" ON "MenuItem"("organizationId");
CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");
CREATE INDEX "MenuItem_countryCode_idx" ON "MenuItem"("countryCode");
CREATE INDEX "MenuItem_category_idx" ON "MenuItem"("category");
CREATE INDEX "MenuItem_status_idx" ON "MenuItem"("status");
CREATE INDEX "MenuItem_isFeatured_idx" ON "MenuItem"("isFeatured");
CREATE UNIQUE INDEX "MenuItemAvailability_menuItemId_dayOfWeek_key" ON "MenuItemAvailability"("menuItemId", "dayOfWeek");
CREATE INDEX "MenuItemAvailability_menuItemId_idx" ON "MenuItemAvailability"("menuItemId");
CREATE INDEX "MenuItemAvailability_dayOfWeek_idx" ON "MenuItemAvailability"("dayOfWeek");

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuItemAvailability" ADD CONSTRAINT "MenuItemAvailability_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedFeatureFlags
INSERT INTO "FeatureFlag" ("id", "key", "name", "description", "enabled", "createdAt", "updatedAt")
VALUES
  ('home_catering_global_feature_flag', 'home_catering', 'home catering', 'Placeholder flag for home_catering.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('menus_global_feature_flag', 'menus', 'menus', 'Placeholder flag for menus.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('restaurant_profiles_global_feature_flag', 'restaurant_profiles', 'restaurant profiles', 'Placeholder flag for restaurant_profiles.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key", "organizationId", "countryCode") DO NOTHING;

-- DemoMenuSeed
INSERT INTO "Menu" ("id", "organizationId", "countryCode", "name", "description", "status", "visibility", "createdAt", "updatedAt")
SELECT 'demo-home-catering-menu', o."id", o."countryCode", 'Demo home catering menu', 'Local demo menu for home catering seller onboarding.', 'active', 'public', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
WHERE o."slug" = 'aminas-hyderabadi-catering'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Menu" ("id", "organizationId", "countryCode", "name", "description", "status", "visibility", "createdAt", "updatedAt")
SELECT 'demo-restaurant-menu', o."id", o."countryCode", 'Demo restaurant menu', 'Local demo restaurant menu for partner profiles.', 'active', 'public', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
WHERE o."slug" = 'biryani-house-demo'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MenuItem" ("id", "organizationId", "menuId", "countryCode", "name", "slug", "description", "cuisine", "category", "priceAmount", "currencyCode", "servingSize", "spiceLevel", "preorderRequired", "minimumNoticeHours", "pickupAvailable", "deliveryAvailable", "ingredientsSummary", "status", "isFeatured", "createdAt", "updatedAt")
SELECT item_id, o."id", 'demo-home-catering-menu', o."countryCode", item_name, item_slug, item_description, 'Hyderabadi', item_category::"MenuItemCategory", item_price, o."currencyCode", item_serving, item_spice::"SpiceLevel", true, 24, true, true, item_ingredients, 'active', item_featured, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (VALUES
  ('demo-catering-chicken-dum-biryani-tray', 'Hyderabadi Chicken Dum Biryani tray', 'hyderabadi-chicken-dum-biryani-tray', 'Layered chicken dum biryani tray for family pickup or preorder.', 'catering_tray', 85.00, 'Serves 8-10', 'medium', 'Basmati rice, chicken, yogurt, fried onions, mint, spices', true),
  ('demo-catering-mutton-biryani-family-pack', 'Mutton Biryani family pack', 'mutton-biryani-family-pack', 'Slow-cooked mutton biryani family pack with salan pairing suggestion.', 'biryani', 95.00, 'Serves 6-8', 'hot', 'Basmati rice, mutton, yogurt, whole spices, saffron', true),
  ('demo-catering-mirchi-ka-salan-side', 'Mirchi ka Salan side', 'mirchi-ka-salan-side', 'Tangy peanut sesame chili salan side for biryani trays.', 'salan', 22.00, '1 quart', 'medium', 'Green chilies, peanuts, sesame, tamarind, spices', false),
  ('demo-catering-double-ka-meetha-tray', 'Double ka Meetha tray', 'double-ka-meetha-tray', 'Classic Hyderabadi bread pudding dessert tray.', 'dessert', 38.00, 'Serves 10-12', 'mild', 'Bread, milk, sugar, cardamom, nuts, ghee', false),
  ('demo-catering-haleem-weekend-special', 'Haleem weekend special', 'haleem-weekend-special', 'Weekend preorder haleem with fried onions, lemon, and mint garnish.', 'special', 18.00, '32 oz', 'medium', 'Wheat, lentils, meat, ghee, spices', true)
) AS seed(item_id, item_name, item_slug, item_description, item_category, item_price, item_serving, item_spice, item_ingredients, item_featured)
WHERE o."slug" = 'aminas-hyderabadi-catering'
ON CONFLICT ("organizationId", "slug") DO NOTHING;

INSERT INTO "MenuItem" ("id", "organizationId", "menuId", "countryCode", "name", "slug", "description", "cuisine", "category", "priceAmount", "currencyCode", "servingSize", "spiceLevel", "preorderRequired", "minimumNoticeHours", "pickupAvailable", "deliveryAvailable", "ingredientsSummary", "status", "isFeatured", "createdAt", "updatedAt")
SELECT item_id, o."id", 'demo-restaurant-menu', o."countryCode", item_name, item_slug, item_description, 'Hyderabadi', item_category::"MenuItemCategory", item_price, o."currencyCode", item_serving, item_spice::"SpiceLevel", false, NULL, true, false, item_ingredients, 'active', item_featured, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (VALUES
  ('demo-restaurant-chicken-biryani', 'Chicken Biryani', 'chicken-biryani', 'Restaurant-style Hyderabadi chicken biryani.', 'biryani', 16.00, '1 entree', 'medium', 'Basmati rice, chicken, fried onions, yogurt, spices', true),
  ('demo-restaurant-mutton-biryani', 'Mutton Biryani', 'mutton-biryani', 'Hyderabadi mutton biryani with salan on the side.', 'biryani', 19.00, '1 entree', 'hot', 'Basmati rice, mutton, whole spices, herbs', true),
  ('demo-restaurant-bagara-rice', 'Bagara Rice', 'bagara-rice', 'Tempered rice with whole spices and fried onions.', 'rice', 10.00, '1 entree', 'mild', 'Rice, onions, mint, whole spices', false),
  ('demo-restaurant-khatti-dal', 'Khatti Dal', 'khatti-dal', 'Tangy Hyderabadi dal with tamarind and tempering.', 'curry', 9.00, '1 bowl', 'medium', 'Toor dal, tamarind, garlic, curry leaves', false),
  ('demo-restaurant-qubani-ka-meetha', 'Qubani ka Meetha', 'qubani-ka-meetha', 'Apricot dessert with a rich syrupy finish.', 'dessert', 7.00, '1 dessert', 'mild', 'Apricots, sugar, cream, nuts', false)
) AS seed(item_id, item_name, item_slug, item_description, item_category, item_price, item_serving, item_spice, item_ingredients, item_featured)
WHERE o."slug" = 'biryani-house-demo'
ON CONFLICT ("organizationId", "slug") DO NOTHING;
