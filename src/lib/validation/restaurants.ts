import { z } from "zod";

export const restaurantSearchSchema = z.object({
  query: z.string().trim().min(1).max(200),
  city: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  region: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  latitude: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(-180).max(180).optional(),
  ),
  recipeId: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().min(1).optional(),
  ),
  mealPlanEntryId: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export type RestaurantSearchInput = z.infer<typeof restaurantSearchSchema>;

export const savedRestaurantCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  latitude: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(-180).max(180).optional(),
  ),
  category: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  mapUrl: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(2048).optional(),
  ),
  notes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  provider: z.enum(["maptiler", "manual"]).default("manual"),
  providerPlaceId: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(200).optional(),
  ),
});

export type SavedRestaurantCreateInput = z.infer<typeof savedRestaurantCreateSchema>;
