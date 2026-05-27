"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BillingInterval, BillingPlanStatus } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { createBillingPlan, updateBillingPlan } from "@/server/billing/plans";

const planPath = "/admin/billing/plans";

export async function createBillingPlanAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);

  try {
    const plan = await createBillingPlan(session, planInputFromForm(formData));
    revalidatePath(planPath);
    redirect(`${planPath}?message=${encodeURIComponent(`${plan.name} pricing plan created successfully.`)}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${planPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create pricing plan. Please check the fields and try again."))}`);
  }
}

export async function updateBillingPlanAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const planId = String(formData.get("planId") ?? "");

  try {
    if (!planId) throw new Error("Choose a pricing plan to update.");
    const input = planInputFromForm(formData);
    const plan = await updateBillingPlan(session, planId, input);
    revalidatePath(planPath);
    revalidatePath("/billing/plans");
    revalidatePath("/pricing");
    redirect(`${planPath}?message=${encodeURIComponent(`${plan.name} pricing plan saved successfully.`)}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${planPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save pricing plan. Please check the fields and try again."))}`);
  }
}

function planInputFromForm(formData: FormData) {
  return {
    name: stringField(formData, "name"),
    slug: stringField(formData, "slug").toLowerCase(),
    description: optionalStringField(formData, "description"),
    priceAmount: numberField(formData, "priceAmount", 0),
    currencyCode: stringField(formData, "currencyCode", "USD").toUpperCase(),
    billingInterval: stringField(formData, "billingInterval", "monthly") as BillingInterval,
    status: stringField(formData, "status", "draft") as BillingPlanStatus,
    stripePriceId: optionalStringField(formData, "stripePriceId"),
    limitsJson: {
      maxMealPlans: limitField(formData, "maxMealPlans", 2),
      maxGroceryListsPerMonth: limitField(formData, "maxGroceryListsPerMonth", 5),
      maxHouseholdMembers: limitField(formData, "maxHouseholdMembers", 1),
      maxSavedRestaurants: limitField(formData, "maxSavedRestaurants", 5),
      maxChefRequestsPerMonth: limitField(formData, "maxChefRequestsPerMonth", 0),
      chefMarketplaceEnabled: formData.get("chefMarketplaceEnabled") === "on",
      groceryExportsEnabled: formData.get("groceryExportsEnabled") === "on",
      restaurantFallbackEnabled: formData.get("restaurantFallbackEnabled") === "on",
    },
    featuresJson: linesField(formData, "featuresText"),
  };
}

function stringField(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function optionalStringField(formData: FormData, key: string) {
  const value = stringField(formData, key);
  return value.length ? value : null;
}

function numberField(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${labelFor(key)} must be 0 or higher.`);
  return value;
}

function limitField(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  if (!Number.isInteger(value) || value < -1) throw new Error(`${labelFor(key)} must be -1 for unlimited, 0, or a positive whole number.`);
  return value;
}

function linesField(formData: FormData, key: string) {
  return stringField(formData, key)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function labelFor(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
