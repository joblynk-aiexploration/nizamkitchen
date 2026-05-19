-- CreateEnum
CREATE TYPE "SupportTicketType" AS ENUM ('bug', 'feedback', 'feature_request', 'account_help', 'billing', 'other');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_review', 'waiting_on_user', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdById" TEXT,
    "assignedToId" TEXT,
    "countryCode" TEXT,
    "type" "SupportTicketType" NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT,
    "browserInfo" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_idx" ON "SupportTicket"("organizationId");

-- CreateIndex
CREATE INDEX "SupportTicket_createdById_idx" ON "SupportTicket"("createdById");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "SupportTicket_countryCode_idx" ON "SupportTicket"("countryCode");

-- CreateIndex
CREATE INDEX "SupportTicket_type_idx" ON "SupportTicket"("type");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "SupportTicketComment_ticketId_idx" ON "SupportTicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "SupportTicketComment_authorId_idx" ON "SupportTicketComment"("authorId");

-- CreateIndex
CREATE INDEX "SupportTicketComment_isInternal_idx" ON "SupportTicketComment"("isInternal");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketComment" ADD CONSTRAINT "SupportTicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketComment" ADD CONSTRAINT "SupportTicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
