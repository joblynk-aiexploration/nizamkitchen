import { z } from "zod";

const optionalString = z.preprocess(
  (value) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 ? text : null;
  },
  z.string().nullable(),
);

const optionalNumber = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
  z.number().nullable(),
);

const optionalInt = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  },
  z.number().int().nullable(),
);

export const dishTemplateSchema = z.object({
  id: optionalString.optional(),
  name: z.string().trim().min(2).max(160),
  slug: optionalString.optional(),
  description: optionalString.optional(),
  cuisineId: optionalString.optional(),
  countryCode: optionalString.optional(),
  region: optionalString.optional(),
  city: optionalString.optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "dessert", "side", "prep"]).nullable().optional(),
  category: z.enum(["biryani", "curry", "salan", "rice", "bread", "snack", "dessert", "drink", "combo", "catering_tray", "special", "other"]),
  defaultServings: optionalInt.optional(),
  defaultPriceAmount: optionalNumber.optional(),
  currencyCode: optionalString.optional(),
  spiceLevel: z.enum(["mild", "medium", "hot", "extra_hot"]).nullable().optional(),
  status: z.enum(["draft", "active", "disabled", "archived"]).default("draft"),
  visibility: z.enum(["internal_admin", "public", "seller_available", "household_available"]).default("internal_admin"),
  ingredientsText: z.string().optional(),
  stepsText: z.string().optional(),
});

export const menuTemplateSchema = z.object({
  id: optionalString.optional(),
  name: z.string().trim().min(2).max(160),
  slug: optionalString.optional(),
  description: optionalString.optional(),
  templateType: z.enum(["daily", "weekly", "monthly", "occasion", "ramadan", "eid", "wedding", "party", "custom"]),
  countryCode: optionalString.optional(),
  region: optionalString.optional(),
  city: optionalString.optional(),
  sellerType: z.enum(["chef_business", "home_catering", "restaurant"]).nullable().optional(),
  householdUseEnabled: z.preprocess((value) => value === "on" || value === true, z.boolean()).default(false),
  sellerUseEnabled: z.preprocess((value) => value === "on" || value === true, z.boolean()).default(false),
  status: z.enum(["draft", "active", "disabled", "archived"]).default("draft"),
  visibility: z.enum(["internal_admin", "public", "seller_available", "household_available"]).default("internal_admin"),
  itemsText: z.string().optional(),
});

export type DishTemplateInput = z.infer<typeof dishTemplateSchema>;
export type MenuTemplateInput = z.infer<typeof menuTemplateSchema>;
