"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { requireMembership } from "@/lib/auth/session";
import {
  addAvoidedIngredient,
  addFavoriteRecipe,
  addPantryItem,
  canAccessFamilyProfiles,
  createHouseholdMemberAccount,
  deleteAvoidedIngredient,
  deletePantryItem,
  removeFavoriteRecipe,
  updatePantryItem,
  upsertShoppingPreference,
  upsertHouseholdProfile,
} from "@/server/household";

async function requireHouseholdAccess() {
  const session = await requireMembership();
  const enabled = await canAccessFamilyProfiles({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  if (!enabled) redirect("/household?message=Household preferences are not enabled for this account yet.");
  if (session.activeOrganization.organizationType !== "household") {
    redirect("/settings?message=Household profiles are available only for household accounts.");
  }
  return session;
}

export async function updateHouseholdProfileAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await upsertHouseholdProfile({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        displayName: formData.get("displayName"),
        countryCode: formData.get("countryCode") || session.activeOrganization.countryCode,
        defaultHouseholdSize: formData.get("defaultHouseholdSize"),
        adultsCount: formData.get("adultsCount"),
        childrenCount: formData.get("childrenCount"),
        defaultServings: formData.get("defaultServings"),
        defaultSpiceLevel: formData.get("defaultSpiceLevel"),
        preferredMeasurementSystem: formData.get("preferredMeasurementSystem"),
        preferredCuisineIds: formData.getAll("preferredCuisineIds"),
        cookingSkillLevel: formData.get("cookingSkillLevel"),
        weeklyCookingDays: formData.getAll("weeklyCookingDays"),
        groceryBudgetAmount: formData.get("groceryBudgetAmount"),
        groceryBudgetCurrency: formData.get("groceryBudgetCurrency"),
        notes: formData.get("notes"),
      },
    });
    revalidateHouseholdPaths();
    redirect("/household/preferences?message=Household profile saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/preferences?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save household profile."))}`);
  }
}

export async function createHouseholdMemberAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await createHouseholdMemberAccount({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      actorRole: session.activeMembership.role,
      countryCode: session.activeOrganization.countryCode,
      input: {
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        password: formData.get("password"),
      },
    });
    revalidateHouseholdPaths();
    redirect("/household/members?message=Family member account created. They can now sign in and see household recipes.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/members?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create family member account."))}`);
  }
}

export async function addAvoidedIngredientAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await addAvoidedIngredient({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        ingredientId: formData.get("ingredientId") || undefined,
        ingredientName: formData.get("ingredientName"),
        reason: formData.get("reason") || undefined,
        severity: formData.get("severity") || "avoid",
      },
    });
    revalidateHouseholdPaths();
    redirect("/household/avoided-ingredients?message=Avoided ingredient added.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/avoided-ingredients?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add avoided ingredient."))}`);
  }
}

export async function deleteAvoidedIngredientAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await deleteAvoidedIngredient({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      avoidedIngredientId: String(formData.get("avoidedIngredientId")),
    });
    revalidateHouseholdPaths();
    redirect("/household/avoided-ingredients?message=Avoided ingredient removed.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/avoided-ingredients?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove avoided ingredient."))}`);
  }
}

export async function favoriteRecipeAction(formData: FormData) {
  const recipeId = String(formData.get("recipeId"));
  try {
    const session = await requireHouseholdAccess();
    const action = String(formData.get("favoriteAction"));
    if (action === "remove") {
      await removeFavoriteRecipe({
        organizationId: session.activeOrganization.id,
        actorUserId: session.user.id,
        countryCode: session.activeOrganization.countryCode,
        recipeId,
      });
      revalidatePath(`/recipes/${recipeId}`);
      revalidatePath("/household/favorites");
      redirect(`/recipes/${recipeId}?message=Removed from favorites.`);
    }
    await addFavoriteRecipe({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: { recipeId },
    });
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath("/household/favorites");
    redirect(`/recipes/${recipeId}?message=Added to favorites.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/recipes/${recipeId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update favorite."))}`);
  }
}

export async function shareHouseholdRecipeAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await addFavoriteRecipe({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        recipeId: formData.get("recipeId"),
        targetServings: formData.get("targetServings"),
      },
    });
    revalidateHouseholdPaths();
    redirect("/household/members?message=Recipe shared with your household.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/members?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to share recipe with your household."))}`);
  }
}

export async function removeFavoriteRecipeAction(formData: FormData) {
  const recipeId = String(formData.get("recipeId"));
  try {
    const session = await requireHouseholdAccess();
    await removeFavoriteRecipe({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      recipeId,
    });
    revalidatePath("/household/favorites");
    redirect("/household/favorites?message=Favorite removed.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/favorites?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove favorite."))}`);
  }
}

export async function addPantryItemAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await addPantryItem({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        ingredientId: formData.get("ingredientId"),
        quantity: formData.get("quantity"),
        unitId: formData.get("unitId") || null,
        notes: formData.get("notes"),
        expiresAt: formData.get("expiresAt"),
      },
    });
    revalidateHouseholdPaths();
    redirect("/household/pantry?message=Pantry item added.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/pantry?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add pantry item."))}`);
  }
}

export async function deletePantryItemAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await deletePantryItem({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      pantryItemId: String(formData.get("pantryItemId")),
    });
    revalidateHouseholdPaths();
    redirect("/household/pantry?message=Pantry item removed.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/pantry?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove pantry item."))}`);
  }
}

export async function updatePantryItemAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await updatePantryItem({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      pantryItemId: String(formData.get("pantryItemId")),
      input: {
        ingredientId: formData.get("ingredientId"),
        quantity: formData.get("quantity"),
        unitId: formData.get("unitId") || null,
        notes: formData.get("notes"),
        expiresAt: formData.get("expiresAt"),
      },
    });
    revalidateHouseholdPaths();
    redirect("/household/pantry?message=Pantry item updated.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/pantry?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update pantry item."))}`);
  }
}

export async function updateShoppingPreferenceAction(formData: FormData) {
  try {
    const session = await requireHouseholdAccess();
    await upsertShoppingPreference({
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      countryCode: session.activeOrganization.countryCode,
      input: {
        preferredStoreName: formData.get("preferredStoreName"),
        preferredShoppingDay: formData.get("preferredShoppingDay"),
        preferredDeliveryMethod: formData.get("preferredDeliveryMethod") || "no_preference",
        notes: formData.get("notes"),
      },
    });
    revalidateHouseholdPaths();
    redirect("/household/shopping-preferences?message=Shopping preferences saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/household/shopping-preferences?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save shopping preferences."))}`);
  }
}

function revalidateHouseholdPaths() {
  revalidatePath("/household");
  revalidatePath("/household/members");
  revalidatePath("/household/preferences");
  revalidatePath("/household/avoided-ingredients");
  revalidatePath("/household/favorites");
  revalidatePath("/household/pantry");
  revalidatePath("/household/shopping-preferences");
  revalidatePath("/settings/meal-preferences");
  revalidatePath("/meal-plans/new");
}
