import { z } from "zod";
import { isFormattedPhoneNumber } from "@/lib/phone";

const fulfillmentValues = ["pickup", "delivery", "preorder", "inquiry_only"] as const;
const sellerStatusValues = ["accepted", "declined", "preparing", "ready_for_pickup", "out_for_delivery", "completed", "cancelled"] as const;
const adminStatusValues = ["submitted", ...sellerStatusValues] as const;

const nullableString = (max = 500) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : new Date(String(value))),
  z.date().nullable(),
);

export const foodOrderCreateSchema = z.object({
  menuItemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(500),
  fulfillmentType: z.enum(fulfillmentValues),
  requestedDate: optionalDate.optional(),
  requestedTimeWindow: nullableString(120).optional(),
  customerName: nullableString(160).optional(),
  customerPhone: nullableString(40).optional().refine(isFormattedPhoneNumber, "Phone number must include a country code and a 10 digit number."),
  customerEmail: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : String(value).trim()),
    z.string().email().max(180).nullable(),
  ).optional(),
  deliveryAddressLine1: nullableString(220).optional(),
  deliveryAddressLine2: nullableString(220).optional(),
  deliveryCity: nullableString(120).optional(),
  deliveryRegion: nullableString(120).optional(),
  deliveryCountryCode: nullableString(2).optional(),
  deliveryPostalCode: nullableString(40).optional(),
  deliveryLatitude: z.coerce.number().finite().nullable().optional(),
  deliveryLongitude: z.coerce.number().finite().nullable().optional(),
  deliveryProviderPlaceId: nullableString(180).optional(),
  customerNotes: nullableString(1000).optional(),
  itemNotes: nullableString(500).optional(),
  promoCode: nullableString(40).optional(),
});

export const foodOrderMessageSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  isInternal: z.coerce.boolean().default(false),
});

export const sellerFoodOrderStatusSchema = z.object({
  status: z.enum(sellerStatusValues),
  note: nullableString(500).optional(),
  sellerNotes: nullableString(1000).optional(),
});

export const adminFoodOrderStatusSchema = z.object({
  status: z.enum(adminStatusValues),
  note: nullableString(500).optional(),
  adminNotes: nullableString(1000).optional(),
});

export type FoodOrderCreateInput = z.infer<typeof foodOrderCreateSchema>;
