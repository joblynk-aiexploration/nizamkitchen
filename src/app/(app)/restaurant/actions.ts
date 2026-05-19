"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { deleteBusinessSocialLink, upsertBusinessSocialLink } from "@/server/business-social-links";

async function requireRestaurantAccess() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    redirect("/dashboard?message=Restaurant tools are only for restaurant organizations.");
  }
  return session;
}

export async function upsertRestaurantSocialLinkAction(formData: FormData) {
  try {
    const session = await requireRestaurantAccess();
    await upsertBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      organizationType: session.activeOrganization.organizationType,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateRestaurantPaths();
    redirect("/restaurant/profile?message=Social link saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save social link."))}`);
  }
}

export async function deleteRestaurantSocialLinkAction(formData: FormData) {
  try {
    const session = await requireRestaurantAccess();
    await deleteBusinessSocialLink({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      actorUserId: session.user.id,
      input: Object.fromEntries(formData),
    });
    revalidateRestaurantPaths();
    redirect("/restaurant/profile?message=Social link deleted.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/profile?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to delete social link."))}`);
  }
}

function revalidateRestaurantPaths() {
  revalidatePath("/restaurant");
  revalidatePath("/restaurant/profile");
  revalidatePath("/restaurants");
}
