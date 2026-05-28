import { z } from "zod";

export const billingPlanCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  description: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().trim().max(500).nullable().optional()),
  priceAmount: z.coerce.number().min(0).default(0),
  currencyCode: z.string().trim().min(3).max(3).default("USD"),
  billingInterval: z.enum(["monthly", "yearly", "custom"]).default("monthly"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  stripePriceId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().trim().max(180).nullable().optional()),
  limitsJson: z.record(z.string(), z.unknown()).default({}),
  featuresJson: z.array(z.unknown()).default([]),
});

export const billingPlanUpdateSchema = billingPlanCreateSchema.partial();

export const billingSubscriptionStatusSchema = z.object({
  status: z.enum(["trialing", "active", "past_due", "cancelled", "unpaid", "free"]),
});

export type BillingPlanCreateInput = z.infer<typeof billingPlanCreateSchema>;
export type BillingPlanUpdateInput = z.infer<typeof billingPlanUpdateSchema>;
