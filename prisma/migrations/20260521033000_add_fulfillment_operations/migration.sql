-- CreateEnum
CREATE TYPE "FulfillmentRecordStatus" AS ENUM ('active', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "FulfillmentTimeSlotType" AS ENUM ('pickup', 'delivery', 'preorder');

-- CreateEnum
CREATE TYPE "FulfillmentEventType" AS ENUM ('scheduled', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled', 'delivery_zone_applied', 'pickup_location_applied', 'note_added');

-- AlterTable
ALTER TABLE "FoodOrder"
  ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'scheduled',
  ADD COLUMN "pickupLocationId" TEXT,
  ADD COLUMN "deliveryZoneId" TEXT,
  ADD COLUMN "fulfillmentTimeSlotId" TEXT,
  ADD COLUMN "preparationMinutes" INTEGER,
  ADD COLUMN "cutoffAt" TIMESTAMP(3),
  ADD COLUMN "promisedReadyAt" TIMESTAMP(3),
  ADD COLUMN "deliveryFeeAmount" DOUBLE PRECISION,
  ADD COLUMN "deliveryCountryCode" TEXT,
  ADD COLUMN "deliveryLatitude" DOUBLE PRECISION,
  ADD COLUMN "deliveryLongitude" DOUBLE PRECISION,
  ADD COLUMN "deliveryProviderPlaceId" TEXT;

-- CreateTable
CREATE TABLE "FulfillmentPickupLocation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "instructions" TEXT,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "region" TEXT,
  "postalCode" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "providerPlaceId" TEXT,
  "timezone" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "status" "FulfillmentRecordStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FulfillmentPickupLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentDeliveryZone" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCodesJson" JSONB,
  "centerLatitude" DOUBLE PRECISION,
  "centerLongitude" DOUBLE PRECISION,
  "radiusKm" DOUBLE PRECISION,
  "minimumOrderAmount" DOUBLE PRECISION,
  "deliveryFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "freeDeliveryAt" DOUBLE PRECISION,
  "estimatedMinutes" INTEGER,
  "status" "FulfillmentRecordStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FulfillmentDeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentTimeSlot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "slotType" "FulfillmentTimeSlotType" NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "capacity" INTEGER,
  "preparationMinutes" INTEGER,
  "cutoffMinutes" INTEGER,
  "status" "FulfillmentRecordStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FulfillmentTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodOrderFulfillmentEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "eventType" "FulfillmentEventType" NOT NULL,
  "statusSnapshot" TEXT,
  "note" TEXT,
  "metadataJson" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FoodOrderFulfillmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodOrder_fulfillmentStatus_idx" ON "FoodOrder"("fulfillmentStatus");
CREATE INDEX "FoodOrder_pickupLocationId_idx" ON "FoodOrder"("pickupLocationId");
CREATE INDEX "FoodOrder_deliveryZoneId_idx" ON "FoodOrder"("deliveryZoneId");
CREATE INDEX "FoodOrder_fulfillmentTimeSlotId_idx" ON "FoodOrder"("fulfillmentTimeSlotId");
CREATE INDEX "FulfillmentPickupLocation_organizationId_idx" ON "FulfillmentPickupLocation"("organizationId");
CREATE INDEX "FulfillmentPickupLocation_countryCode_idx" ON "FulfillmentPickupLocation"("countryCode");
CREATE INDEX "FulfillmentPickupLocation_status_idx" ON "FulfillmentPickupLocation"("status");
CREATE INDEX "FulfillmentPickupLocation_isDefault_idx" ON "FulfillmentPickupLocation"("isDefault");
CREATE INDEX "FulfillmentDeliveryZone_organizationId_idx" ON "FulfillmentDeliveryZone"("organizationId");
CREATE INDEX "FulfillmentDeliveryZone_countryCode_idx" ON "FulfillmentDeliveryZone"("countryCode");
CREATE INDEX "FulfillmentDeliveryZone_status_idx" ON "FulfillmentDeliveryZone"("status");
CREATE INDEX "FulfillmentTimeSlot_organizationId_idx" ON "FulfillmentTimeSlot"("organizationId");
CREATE INDEX "FulfillmentTimeSlot_countryCode_idx" ON "FulfillmentTimeSlot"("countryCode");
CREATE INDEX "FulfillmentTimeSlot_slotType_idx" ON "FulfillmentTimeSlot"("slotType");
CREATE INDEX "FulfillmentTimeSlot_dayOfWeek_idx" ON "FulfillmentTimeSlot"("dayOfWeek");
CREATE INDEX "FulfillmentTimeSlot_status_idx" ON "FulfillmentTimeSlot"("status");
CREATE INDEX "FoodOrderFulfillmentEvent_orderId_idx" ON "FoodOrderFulfillmentEvent"("orderId");
CREATE INDEX "FoodOrderFulfillmentEvent_organizationId_idx" ON "FoodOrderFulfillmentEvent"("organizationId");
CREATE INDEX "FoodOrderFulfillmentEvent_countryCode_idx" ON "FoodOrderFulfillmentEvent"("countryCode");
CREATE INDEX "FoodOrderFulfillmentEvent_eventType_idx" ON "FoodOrderFulfillmentEvent"("eventType");
CREATE INDEX "FoodOrderFulfillmentEvent_createdAt_idx" ON "FoodOrderFulfillmentEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "FulfillmentPickupLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "FulfillmentDeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_fulfillmentTimeSlotId_fkey" FOREIGN KEY ("fulfillmentTimeSlotId") REFERENCES "FulfillmentTimeSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FulfillmentPickupLocation" ADD CONSTRAINT "FulfillmentPickupLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentDeliveryZone" ADD CONSTRAINT "FulfillmentDeliveryZone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentTimeSlot" ADD CONSTRAINT "FulfillmentTimeSlot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FoodOrderFulfillmentEvent" ADD CONSTRAINT "FoodOrderFulfillmentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FoodOrderFulfillmentEvent" ADD CONSTRAINT "FoodOrderFulfillmentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FoodOrderFulfillmentEvent" ADD CONSTRAINT "FoodOrderFulfillmentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
