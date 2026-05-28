"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { canAccessMenus, upsertMenu, upsertMenuItem } from "@/server/menus";
import { applyMenuTemplateToSellerMenu } from "@/server/templates";

async function requireMenuOwnerAccess(expectedType: "home_catering" | "restaurant") {
  const session = await requireMembership();
  const organizationType = session.activeOrganization.organizationType;
  if (organizationType !== expectedType) {
    redirect("/dashboard?message=Menu tools are not available for this organization type.");
  }
  const enabled = await canAccessMenus({
    organizationId: session.activeOrganization.id,
    organizationType,
    platformRole: session.user.platformRole,
  });
  if (!enabled) redirect("/feature-disabled?feature=menus");
  return session;
}

function inputFromMenuItemForm(formData: FormData, currencyCode: string) {
  return {
    menuItemId: formData.get("menuItemId"),
    menuId: formData.get("menuId"),
    name: formData.get("name"),
    description: formData.get("description"),
    cuisine: formData.get("cuisine"),
    category: formData.get("category"),
    priceAmount: formData.get("priceAmount"),
    currencyCode: formData.get("currencyCode") || currencyCode,
    servingSize: formData.get("servingSize"),
    spiceLevel: formData.get("spiceLevel"),
    preparationTimeMinutes: formData.get("preparationTimeMinutes"),
    minimumOrderQuantity: formData.get("minimumOrderQuantity"),
    maxDailyQuantity: formData.get("maxDailyQuantity"),
    availableFrom: formData.get("availableFrom"),
    availableUntil: formData.get("availableUntil"),
    preorderRequired: formData.get("preorderRequired") === "on",
    minimumNoticeHours: formData.get("minimumNoticeHours"),
    pickupAvailable: formData.get("pickupAvailable") === "on",
    deliveryAvailable: formData.get("deliveryAvailable") === "on",
    photoUrl: formData.get("photoUrl"),
    photoFileId: formData.get("photoFileId"),
    allergens: formData.get("allergens"),
    ingredientsSummary: formData.get("ingredientsSummary"),
    status: formData.get("status"),
    isFeatured: formData.get("isFeatured") === "on",
    availableDays: formData.getAll("availableDays"),
  };
}

export async function upsertCateringMenuAction(formData: FormData) {
  try {
    const session = await requireMenuOwnerAccess("home_catering");
    const menu = await upsertMenu({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      organizationType: session.activeOrganization.organizationType,
      actorUserId: session.user.id,
      input: {
        menuId: formData.get("menuId"),
        name: formData.get("name"),
        description: formData.get("description"),
        status: formData.get("status"),
        visibility: formData.get("visibility"),
      },
    });
    revalidateCateringMenuPaths();
    redirect(`/catering/menu/${menu.id}?message=Menu saved.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/menu?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save menu."))}`);
  }
}

export async function createCateringMenuFromTemplateAction(formData: FormData) {
  try {
    const session = await requireMenuOwnerAccess("home_catering");
    const menu = await applyMenuTemplateToSellerMenu({
      templateId: String(formData.get("templateId")),
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      currencyCode: session.activeOrganization.currencyCode,
      actorUserId: session.user.id,
      sellerType: "home_catering",
    });
    revalidateCateringMenuPaths();
    redirect(`/catering/menu/${menu.id}?message=Menu created from template.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/menu?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to apply menu template."))}`);
  }
}

export async function upsertCateringMenuItemAction(formData: FormData) {
  try {
    const session = await requireMenuOwnerAccess("home_catering");
    const item = await upsertMenuItem({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      organizationType: session.activeOrganization.organizationType,
      actorUserId: session.user.id,
      input: inputFromMenuItemForm(formData, session.activeOrganization.currencyCode),
    });
    revalidateCateringMenuPaths();
    redirect(`/catering/menu-items?message=${encodeURIComponent(`${item.name} was successfully saved.`)}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/menu-items?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save menu item."))}`);
  }
}

function revalidateCateringMenuPaths() {
  revalidatePath("/catering/menu");
  revalidatePath("/catering/menu-items");
  revalidatePath("/caterers");
}
