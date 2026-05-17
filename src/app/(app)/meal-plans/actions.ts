"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import {
  addMealPlanEntry,
  canAccessMealPlanner,
  createMealPlan,
  deleteMealPlan,
  deleteMealPlanEntry,
  duplicateMealPlan,
  generateGroceryListFromMealPlan,
  moveMealPlanEntry,
  updateMealPlan,
  updateMealPlanEntry,
  updateMealPlanPreference,
} from "@/server/meal-plans";

function listFromFormData(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .flatMap((value) =>
      String(value)
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    );
}

async function requireMealPlannerAccess() {
  const session = await requireMembership();
  const enabled = await canAccessMealPlanner({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    redirect("/meal-plans?message=Meal planner is not enabled for this organization.");
  }

  return session;
}

export async function createMealPlanAction(formData: FormData) {
  const session = await requireMealPlannerAccess();

  const plan = await createMealPlan({
    organizationId: session.activeOrganization.id,
    countryCode: session.activeOrganization.countryCode,
    createdById: session.user.id,
    input: {
      name: formData.get("name"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      householdSize: formData.get("householdSize"),
      notes: formData.get("notes"),
    },
  });

  revalidatePath("/meal-plans");
  redirect(`/meal-plans/${plan.id}/edit?message=Meal plan created.`);
}

export async function updateMealPlanAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));

  await updateMealPlan({
    mealPlanId,
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
    input: {
      name: formData.get("name"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      householdSize: formData.get("householdSize"),
      notes: formData.get("notes"),
      status: formData.get("status") || undefined,
    },
  });

  revalidatePath(`/meal-plans/${mealPlanId}`);
  revalidatePath(`/meal-plans/${mealPlanId}/edit`);
  revalidatePath("/meal-plans");
  redirect(`/meal-plans/${mealPlanId}/edit?message=Meal plan updated.`);
}

export async function addMealPlanEntryAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));

  await addMealPlanEntry({
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
    input: {
      mealPlanDayId: formData.get("mealPlanDayId"),
      recipeId: formData.get("recipeId") || undefined,
      customMealName: formData.get("customMealName") || undefined,
      mealType: formData.get("mealType"),
      targetServings: formData.get("targetServings"),
      notes: formData.get("notes") || undefined,
      status: formData.get("status") || "planned",
    },
  });

  revalidatePath(`/meal-plans/${mealPlanId}`);
  revalidatePath(`/meal-plans/${mealPlanId}/edit`);
  redirect(`/meal-plans/${mealPlanId}/edit?message=Meal added.`);
}

export async function updateMealPlanEntryAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));
  const entryId = String(formData.get("entryId"));

  await updateMealPlanEntry({
    entryId,
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
    input: {
      recipeId: formData.get("recipeId") || undefined,
      customMealName: formData.get("customMealName") || undefined,
      mealType: formData.get("mealType") || undefined,
      targetServings: formData.get("targetServings") || undefined,
      notes: formData.get("notes") || undefined,
      status: formData.get("status") || undefined,
    },
  });

  revalidatePath(`/meal-plans/${mealPlanId}`);
  revalidatePath(`/meal-plans/${mealPlanId}/edit`);
  redirect(`/meal-plans/${mealPlanId}/edit?message=Meal updated.`);
}

export async function deleteMealPlanEntryAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));
  const entryId = String(formData.get("entryId"));

  await deleteMealPlanEntry({
    entryId,
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
  });

  revalidatePath(`/meal-plans/${mealPlanId}`);
  revalidatePath(`/meal-plans/${mealPlanId}/edit`);
  redirect(`/meal-plans/${mealPlanId}/edit?message=Meal removed.`);
}

export async function moveMealPlanEntryAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));
  const entryId = String(formData.get("entryId"));
  const direction = String(formData.get("direction")) as "up" | "down";

  await moveMealPlanEntry({
    entryId,
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
    direction,
  });

  revalidatePath(`/meal-plans/${mealPlanId}`);
  revalidatePath(`/meal-plans/${mealPlanId}/edit`);
  redirect(`/meal-plans/${mealPlanId}/edit`);
}

export async function duplicateMealPlanAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));

  const duplicate = await duplicateMealPlan({
    mealPlanId,
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
    input: {
      name: formData.get("name") || undefined,
      startDate: formData.get("startDate") || undefined,
    },
  });

  revalidatePath("/meal-plans");
  redirect(`/meal-plans/${duplicate.id}/edit?message=Meal plan duplicated.`);
}

export async function deleteMealPlanAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));

  await deleteMealPlan({
    mealPlanId,
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
  });

  revalidatePath("/meal-plans");
  redirect("/meal-plans?message=Meal plan deleted.");
}

export async function generateMealPlanGroceryListAction(formData: FormData) {
  const session = await requireMealPlannerAccess();
  const mealPlanId = String(formData.get("mealPlanId"));

  const groceryList = await generateGroceryListFromMealPlan({
    organizationId: session.activeOrganization.id,
    mealPlanId,
    createdById: session.user.id,
  });

  revalidatePath(`/meal-plans/${mealPlanId}`);
  revalidatePath(`/meal-plans/${mealPlanId}/grocery-list`);
  revalidatePath("/grocery-lists");
  redirect(`/grocery-lists/${groceryList.id}?message=Grocery list generated from meal plan.`);
}

export async function updateMealPlanPreferencesAction(formData: FormData) {
  const session = await requireMealPlannerAccess();

  await updateMealPlanPreference({
    organizationId: session.activeOrganization.id,
    actorUserId: session.user.id,
    countryCode: session.activeOrganization.countryCode,
    input: {
      defaultHouseholdSize: formData.get("defaultHouseholdSize") || null,
      defaultCountryCode: formData.get("defaultCountryCode") || null,
      preferredCuisines: listFromFormData(formData, "preferredCuisines"),
      avoidedIngredients: listFromFormData(formData, "avoidedIngredients"),
      spicePreference: formData.get("spicePreference") || null,
      dietaryNotes: formData.get("dietaryNotes") || null,
      weeklyCookingDays: formData.getAll("weeklyCookingDays"),
      measurementSystem: formData.get("measurementSystem") || null,
    },
  });

  revalidatePath("/settings/meal-preferences");
  redirect("/settings/meal-preferences?message=Meal preferences updated.");
}
