"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { saveDeliveryZone, savePickupLocation, saveTimeSlot } from "@/server/fulfillment/fulfillment-service";

async function requireRestaurantFulfillmentSession() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    redirect("/dashboard?message=Restaurant fulfillment is only for restaurant organizations.");
  }
  return session;
}

export async function saveRestaurantPickupLocationAction(formData: FormData) {
  try {
    const session = await requireRestaurantFulfillmentSession();
    await savePickupLocation({ session, input: Object.fromEntries(formData) });
    revalidateRestaurantFulfillment();
    redirect("/restaurant/fulfillment/pickup?message=Pickup location saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/fulfillment/pickup?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save pickup location."))}`);
  }
}

export async function saveRestaurantDeliveryZoneAction(formData: FormData) {
  try {
    const session = await requireRestaurantFulfillmentSession();
    await saveDeliveryZone({ session, input: Object.fromEntries(formData) });
    revalidateRestaurantFulfillment();
    redirect("/restaurant/fulfillment/delivery-zones?message=Delivery zone saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/fulfillment/delivery-zones?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save delivery zone."))}`);
  }
}

export async function saveRestaurantTimeSlotAction(formData: FormData) {
  try {
    const session = await requireRestaurantFulfillmentSession();
    await saveTimeSlot({ session, input: Object.fromEntries(formData) });
    revalidateRestaurantFulfillment();
    redirect("/restaurant/fulfillment/time-slots?message=Time slot saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/fulfillment/time-slots?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save time slot."))}`);
  }
}

function revalidateRestaurantFulfillment() {
  revalidatePath("/restaurant/fulfillment");
  revalidatePath("/restaurant/fulfillment/pickup");
  revalidatePath("/restaurant/fulfillment/delivery-zones");
  revalidatePath("/restaurant/fulfillment/time-slots");
}
