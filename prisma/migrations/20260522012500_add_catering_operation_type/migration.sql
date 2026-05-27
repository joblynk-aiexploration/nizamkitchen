CREATE TYPE "CateringOperationType" AS ENUM ('home_caterer', 'restaurant_caterer');

ALTER TABLE "HomeCateringProfile"
  ADD COLUMN "operationType" "CateringOperationType" NOT NULL DEFAULT 'home_caterer',
  ADD COLUMN "restaurantName" TEXT,
  ADD COLUMN "restaurantAddress" TEXT,
  ADD COLUMN "restaurantLicense" TEXT;
