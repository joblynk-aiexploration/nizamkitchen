ALTER TABLE "FavoriteRecipe"
  ADD COLUMN "recipientUserId" TEXT;

DROP INDEX IF EXISTS "FavoriteRecipe_organizationId_recipeId_key";

CREATE INDEX "FavoriteRecipe_recipientUserId_idx" ON "FavoriteRecipe"("recipientUserId");

CREATE UNIQUE INDEX "FavoriteRecipe_household_share_key"
  ON "FavoriteRecipe"("organizationId", "recipeId")
  WHERE "recipientUserId" IS NULL;

CREATE UNIQUE INDEX "FavoriteRecipe_member_share_key"
  ON "FavoriteRecipe"("organizationId", "recipeId", "recipientUserId")
  WHERE "recipientUserId" IS NOT NULL;

ALTER TABLE "FavoriteRecipe"
  ADD CONSTRAINT "FavoriteRecipe_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
