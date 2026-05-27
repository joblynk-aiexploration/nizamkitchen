import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
  confirmPassword: z.string().min(1),
}).superRefine((value, ctx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    });
  }
});

export function getPasswordResetValidationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = String(issue?.path[0] ?? "");

  if (field === "email") return "Enter a valid email address.";
  if (field === "token") return "This reset link is invalid. Please request a new password reset link.";
  if (field === "password") {
    if (issue?.message && !issue.message.toLowerCase().includes("invalid")) return issue.message;
    return "Password must be at least 8 characters and include uppercase, lowercase, and a number.";
  }
  if (field === "confirmPassword") return "Passwords do not match.";

  return "Please check the password reset form and try again.";
}

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
  accountType: z.enum(["household", "chef", "catering", "restaurant"]).default("household"),
  cateringOperationType: z.enum(["home_caterer", "restaurant_caterer"]).default("home_caterer"),
  restaurantName: z.string().trim().max(180).optional(),
  restaurantAddress: z.string().trim().max(500).optional(),
  restaurantLicense: z.string().trim().max(140).optional(),
  acceptLegalTerms: z.string().optional(),
  selectedPlanSlug: z.string().trim().max(80).optional(),
  householdSize: z.coerce.number().int().min(1).max(20).optional(),
  spiceLevel: z.enum(["mild", "medium", "hot", "extra_hot"]).optional(),
  cuisineIds: z.union([z.string(), z.array(z.string())]).optional().transform((v) =>
    v === undefined ? [] : Array.isArray(v) ? v : [v],
  ),
}).superRefine((value, ctx) => {
  if (value.accountType !== "catering" || value.cateringOperationType !== "restaurant_caterer") return;
  if (!value.restaurantName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["restaurantName"],
      message: "Enter the restaurant name.",
    });
  }
  if (!value.restaurantAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["restaurantAddress"],
      message: "Enter the restaurant address.",
    });
  }
});

export function getRegistrationValidationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = String(issue?.path[0] ?? "");

  if (field === "fullName") return "Enter your full name.";
  if (field === "email") return "Enter a valid email address.";
  if (field === "password") {
    if (issue?.message && !issue.message.toLowerCase().includes("invalid")) return issue.message;
    return "Password must be at least 8 characters and include uppercase, lowercase, and a number.";
  }
  if (field === "organizationName") return "Enter your household or business name.";
  if (field === "countryCode") return "Choose your country.";
  if (field === "accountType") return "Choose the account type that best matches you.";
  if (field === "cateringOperationType") return "Choose whether this is a home caterer or restaurant caterer.";
  if (field === "restaurantName") return "Enter the restaurant name.";
  if (field === "restaurantAddress") return "Enter the restaurant address.";
  if (field === "restaurantLicense") return "Enter a shorter restaurant license or permit number.";
  if (field === "selectedPlanSlug") return "Choose a valid billing plan.";
  if (field === "householdSize") return "Choose a valid household size.";
  if (field === "spiceLevel") return "Choose a valid spice level.";
  if (field === "cuisineIds") return "Choose valid cuisine preferences.";

  return "Please check the highlighted registration fields and try again.";
}

export const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().min(2).max(3).toUpperCase(),
  organizationType: z.enum([
    "household",
    "chef_business",
    "home_catering",
    "restaurant",
    "grocery_partner",
    "internal_admin",
  ]),
});
