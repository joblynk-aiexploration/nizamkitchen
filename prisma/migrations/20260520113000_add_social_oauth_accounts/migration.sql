-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'facebook');

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "rawProfileJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
CREATE UNIQUE INDEX "OAuthAccount_userId_provider_key" ON "OAuthAccount"("userId", "provider");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
CREATE INDEX "OAuthAccount_email_idx" ON "OAuthAccount"("email");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
