ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locationText" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_publicProfileEnabled_idx" ON "User"("publicProfileEnabled");
