-- CreateEnum
CREATE TYPE "FoodOrderSellerType" AS ENUM ('home_catering', 'restaurant');

-- CreateEnum
CREATE TYPE "FoodOrderStatus" AS ENUM ('draft', 'submitted', 'accepted', 'declined', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "FoodOrderFulfillmentType" AS ENUM ('pickup', 'delivery', 'preorder', 'inquiry_only');

-- CreateTable
CREATE TABLE "FoodOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "customerOrganizationId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "sellerType" "FoodOrderSellerType" NOT NULL,
    "status" "FoodOrderStatus" NOT NULL DEFAULT 'submitted',
    "fulfillmentType" "FoodOrderFulfillmentType" NOT NULL,
    "requestedDate" TIMESTAMP(3),
    "requestedTimeWindow" TEXT,
    "subtotalAmount" DOUBLE PRECISION,
    "currencyCode" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "pickupAddressSnapshot" TEXT,
    "deliveryAddressLine1" TEXT,
    "deliveryAddressLine2" TEXT,
    "deliveryCity" TEXT,
    "deliveryRegion" TEXT,
    "deliveryPostalCode" TEXT,
    "customerNotes" TEXT,
    "sellerNotes" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FoodOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceAmount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodOrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodOrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "oldStatus" "FoodOrderStatus",
    "newStatus" "FoodOrderStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodOrder_organizationId_idx" ON "FoodOrder"("organizationId");

-- CreateIndex
CREATE INDEX "FoodOrder_customerOrganizationId_idx" ON "FoodOrder"("customerOrganizationId");

-- CreateIndex
CREATE INDEX "FoodOrder_customerUserId_idx" ON "FoodOrder"("customerUserId");

-- CreateIndex
CREATE INDEX "FoodOrder_sellerOrganizationId_idx" ON "FoodOrder"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "FoodOrder_countryCode_idx" ON "FoodOrder"("countryCode");

-- CreateIndex
CREATE INDEX "FoodOrder_sellerType_idx" ON "FoodOrder"("sellerType");

-- CreateIndex
CREATE INDEX "FoodOrder_status_idx" ON "FoodOrder"("status");

-- CreateIndex
CREATE INDEX "FoodOrder_createdAt_idx" ON "FoodOrder"("createdAt");

-- CreateIndex
CREATE INDEX "FoodOrderItem_orderId_idx" ON "FoodOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "FoodOrderItem_menuItemId_idx" ON "FoodOrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "FoodOrderMessage_orderId_idx" ON "FoodOrderMessage"("orderId");

-- CreateIndex
CREATE INDEX "FoodOrderMessage_senderUserId_idx" ON "FoodOrderMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "FoodOrderMessage_isInternal_idx" ON "FoodOrderMessage"("isInternal");

-- CreateIndex
CREATE INDEX "FoodOrderStatusHistory_orderId_idx" ON "FoodOrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "FoodOrderStatusHistory_changedById_idx" ON "FoodOrderStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "FoodOrderStatusHistory_newStatus_idx" ON "FoodOrderStatusHistory"("newStatus");

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_customerOrganizationId_fkey" FOREIGN KEY ("customerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderItem" ADD CONSTRAINT "FoodOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderItem" ADD CONSTRAINT "FoodOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderMessage" ADD CONSTRAINT "FoodOrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderMessage" ADD CONSTRAINT "FoodOrderMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderStatusHistory" ADD CONSTRAINT "FoodOrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderStatusHistory" ADD CONSTRAINT "FoodOrderStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
