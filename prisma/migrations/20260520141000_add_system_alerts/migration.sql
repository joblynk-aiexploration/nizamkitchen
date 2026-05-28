-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SystemAlertSeverity" AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SystemAlertStatus" AS ENUM ('open', 'resolved', 'ignored');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemAlert" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" "SystemAlertSeverity" NOT NULL DEFAULT 'info',
  "status" "SystemAlertStatus" NOT NULL DEFAULT 'open',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadataJson" JSONB,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SystemAlert_status_idx" ON "SystemAlert"("status");
CREATE INDEX IF NOT EXISTS "SystemAlert_severity_idx" ON "SystemAlert"("severity");
CREATE INDEX IF NOT EXISTS "SystemAlert_type_idx" ON "SystemAlert"("type");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SystemAlert"
  ADD CONSTRAINT "SystemAlert_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
