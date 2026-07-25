"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAnalyticsEvent } from "@/lib/analytics/events";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { requireMembership } from "@/lib/auth/session";
import {
  addMealPlanEntry,
  canAccessMealPlanner,
  createMealPlan,
  createReadyMadeMealPlan,
  deleteMealPlan,
  deleteMealPlanEntry,
  duplicateMealPlan,
  generateGroceryListFromMealPlan,
  moveMealPlanEntry,
  replaceLegacyGlobalMealPlanEntryWithMyRecipe,
  updateMealPlan,
  updateMealPlanEntry,
  updateMealPlanPreference,
} from "@/server/meal-plans";
import { copyRecipeToMyRecipes } from "@/server/recipes";
import { applyMenuTemplateToMealPlan } from "@/server/templates";

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
  try {
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
    redirect(withAnalyticsEvent(`/meal-plans/${plan.id}/edit?message=Meal plan created.`, "meal_plan_created"));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create meal plan."))}`);
  }
}

export async function createMealPlanFromTemplateAction(formData: FormData) {
  try {
    const session = await requireMealPlannerAccess();
    const plan = await applyMenuTemplateToMealPlan({
      session,
      templateId: String(formData.get("templateId")),
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      householdSize: Number(formData.get("householdSize") ?? 4),
      startDate: String(formData.get("startDate")),
    });

    revalidatePath("/meal-plans");
    redirect(withAnalyticsEvent(`/meal-plans/${plan.id}/edit?message=Meal plan created from template.`, "meal_plan_created"));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to apply meal plan template."))}`);
  }
}

export async function createReadyMadeMealPlanAction(formData: FormData) {
  try {
    const session = await requireMealPlannerAccess();

    const plan = await createReadyMadeMealPlan({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      createdById: session.user.id,
      input: {
        name: formData.get("name"),
        startDate: formData.get("startDate"),
        duration: formData.get("duration"),
        householdSize: formData.get("householdSize"),
        restrictions: formData.get("restrictions"),
        dietPreference: formData.get("dietPreference"),
        preferredFoods: formData.get("preferredFoods"),
        weekdayPreferenceDays: formData.getAll("weekdayPreferenceDays"),
        weekdayPreferenceRecipeIds: formData.getAll("weekdayPreferenceRecipeIds"),
        occasionName: formData.get("occasionName"),
        occasionDate: formData.get("occasionDate"),
        occasionCulture: formData.get("occasionCulture"),
        occasionFoods: formData.get("occasionFoods"),
      },
    });

    revalidatePath("/meal-plans");
    redirect(withAnalyticsEvent(`/meal-plans/${plan.id}/edit?message=Ready-made meal plan created with breakfast, lunch, and dinner.`, "meal_plan_created"));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create ready-made meal plan."))}`);
  }
}

export async function updateMealPlanAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  try {
    const session = await requireMealPlannerAccess();

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
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update meal plan."))}`);
  }
}

export async function addMealPlanEntryAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  try {
    const session = await requireMealPlannerAccess();

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
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add meal."))}`);
  }
}

export async function addGlobalRecipeToMealPlanAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  try {
    const session = await requireMealPlannerAccess();
    const globalRecipeId = String(formData.get("globalRecipeId") ?? "").trim();
    if (!globalRecipeId) {
      throw new Error("Choose a global recipe to add to My Recipes first.");
    }

    const copiedRecipe = await copyRecipeToMyRecipes({
      session,
      recipeId: globalRecipeId,
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
    });

    await addMealPlanEntry({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      input: {
        mealPlanDayId: formData.get("mealPlanDayId"),
        recipeId: copiedRecipe.id,
        mealType: formData.get("mealType"),
        targetServings: formData.get("targetServings"),
        notes: formData.get("notes") || undefined,
        status: formData.get("status") || "planned",
      },
    });

    revalidatePath(`/meal-plans/${mealPlanId}`);
    revalidatePath(`/meal-plans/${mealPlanId}/edit`);
    revalidatePath("/recipes/my");
    redirect(`/meal-plans/${mealPlanId}/edit?message=Recipe added to My Recipes and used in the meal plan.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add global recipe."))}`);
  }
}

export async function replaceLegacyGlobalRecipeEntryAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));
  const entryId = String(formData.get("entryId"));

  try {
    const session = await requireMealPlannerAccess();

    await replaceLegacyGlobalMealPlanEntryWithMyRecipe({
      session,
      entryId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
    });

    revalidatePath(`/meal-plans/${mealPlanId}`);
    revalidatePath(`/meal-plans/${mealPlanId}/edit`);
    revalidatePath("/recipes/my");
    redirect(`/meal-plans/${mealPlanId}/edit?message=Global recipe copied to My Recipes and attached to this entry.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to copy this recipe."))}`);
  }
}

export async function updateMealPlanEntryAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));
  const entryId = String(formData.get("entryId"));

  try {
    const session = await requireMealPlannerAccess();

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
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update meal."))}`);
  }
}

export async function deleteMealPlanEntryAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));
  const entryId = String(formData.get("entryId"));

  try {
    const session = await requireMealPlannerAccess();

    await deleteMealPlanEntry({
      entryId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
    });

    revalidatePath(`/meal-plans/${mealPlanId}`);
    revalidatePath(`/meal-plans/${mealPlanId}/edit`);
    redirect(`/meal-plans/${mealPlanId}/edit?message=Meal removed.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove meal."))}`);
  }
}

export async function moveMealPlanEntryAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));
  const entryId = String(formData.get("entryId"));
  const direction = String(formData.get("direction")) as "up" | "down";

  try {
    const session = await requireMealPlannerAccess();

    await moveMealPlanEntry({
      entryId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      direction,
    });

    revalidatePath(`/meal-plans/${mealPlanId}`);
    revalidatePath(`/meal-plans/${mealPlanId}/edit`);
    redirect(`/meal-plans/${mealPlanId}/edit`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to move meal."))}`);
  }
}

export async function duplicateMealPlanAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  try {
    const session = await requireMealPlannerAccess();

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
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to duplicate meal plan."))}`);
  }
}

export async function deleteMealPlanAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  try {
    const session = await requireMealPlannerAccess();

    await deleteMealPlan({
      mealPlanId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
    });

    revalidatePath("/meal-plans");
    redirect("/meal-plans?message=Meal plan deleted.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to delete meal plan."))}`);
  }
}

export async function generateMealPlanGroceryListAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  try {
    const session = await requireMealPlannerAccess();

    const groceryList = await generateGroceryListFromMealPlan({
      organizationId: session.activeOrganization.id,
      mealPlanId,
      createdById: session.user.id,
    });

    revalidatePath(`/meal-plans/${mealPlanId}`);
    revalidatePath(`/meal-plans/${mealPlanId}/grocery-list`);
    revalidatePath("/grocery-lists");
    redirect(withAnalyticsEvent(`/grocery-lists/${groceryList.id}?message=Grocery list generated from meal plan.`, "grocery_list_generated"));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/meal-plans/${mealPlanId}/grocery-list?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to generate grocery list."))}`);
  }
}

export async function updateMealPlanPreferencesAction(formData: FormData) {
  try {
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
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/settings/meal-preferences?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update meal preferences."))}`);
  }
}
