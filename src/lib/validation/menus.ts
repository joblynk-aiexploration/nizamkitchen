import { z } from "zod";

const menuStatusValues = ["draft", "active", "paused", "archived"] as const;
const menuVisibilityValues = ["private", "public"] as const;
const menuItemStatusValues = ["draft", "active", "sold_out", "paused", "archived"] as const;
const menuItemCategoryValues = [
  "biryani",
  "curry",
  "salan",
  "rice",
  "bread",
  "snack",
  "dessert",
  "drink",
  "combo",
  "catering_tray",
  "special",
  "other",
] as const;
const spiceLevelValues = ["mild", "medium", "hot", "extra_hot"] as const;

const nullableString = (max = 500) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

const nullableNumber = (min = 0, max = 1_000_000) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().min(min).max(max).nullable(),
  );

const nullableInt = (min = 0, max = 100_000) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().min(min).max(max).nullable(),
  );

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : new Date(String(value))),
  z.date().nullable(),
);

const listFromFormValue = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string().min(1).max(120)).max(40));

export const menuSchema = z.object({
  menuId: nullableString(80).optional(),
  name: z.string().trim().min(2).max(140),
  description: nullableString(1000).optional(),
  status: z.enum(menuStatusValues).default("draft"),
  visibility: z.enum(menuVisibilityValues).default("private"),
});

export const menuItemSchema = z.object({
  menuItemId: nullableString(80).optional(),
  menuId: nullableString(80).optional(),
  name: z.string().trim().min(2).max(140),
  description: nullableString(1200).optional(),
  cuisine: nullableString(120).optional(),
  category: z.enum(menuItemCategoryValues),
  priceAmount: nullableNumber(0, 100_000).optional(),
  currencyCode: z.string().trim().toUpperCase().length(3),
  servingSize: nullableString(120).optional(),
  spiceLevel: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.enum(spiceLevelValues).nullable(),
  ).optional(),
  preparationTimeMinutes: nullableInt(0, 10_000).optional(),
  minimumOrderQuantity: nullableInt(1, 10_000).optional(),
  maxDailyQuantity: nullableInt(1, 100_000).optional(),
  availableFrom: optionalDate.optional(),
  availableUntil: optionalDate.optional(),
  preorderRequired: z.coerce.boolean().default(false),
  minimumNoticeHours: nullableInt(0, 720).optional(),
  pickupAvailable: z.coerce.boolean().default(false),
  deliveryAvailable: z.coerce.boolean().default(false),
  photoUrl: nullableString(500).optional(),
  allergens: listFromFormValue.default([]),
  ingredientsSummary: nullableString(1000).optional(),
  status: z.enum(menuItemStatusValues).default("draft"),
  isFeatured: z.coerce.boolean().default(false),
  availableDays: z.preprocess((value) => {
    if (Array.isArray(value)) return value.map(Number).filter((n) => Number.isInteger(n));
    if (value === "" || value === null || value === undefined) return [];
    return [Number(value)].filter((n) => Number.isInteger(n));
  }, z.array(z.number().int().min(0).max(6)).max(7)).default([]),
}).superRefine((value, ctx) => {
  if (value.availableFrom && value.availableUntil && value.availableUntil < value.availableFrom) {
    ctx.addIssue({
      code: "custom",
      path: ["availableUntil"],
      message: "Available until must be after available from.",
    });
  }
});

export const adminMenuItemStatusSchema = z.object({
  status: z.enum(menuItemStatusValues),
  reason: nullableString(500).optional(),
});

export type MenuInput = z.infer<typeof menuSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
