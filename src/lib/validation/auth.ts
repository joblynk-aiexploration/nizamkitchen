import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
  organizationName: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().min(2).max(3).toUpperCase(),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().min(2).max(3).toUpperCase(),
  organizationType: z.enum([
    "household",
    "chef_business",
    "restaurant",
    "grocery_partner",
    "internal_admin",
  ]),
});
