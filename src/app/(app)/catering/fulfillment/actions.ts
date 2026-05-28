"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { saveDeliveryZone, savePickupLocation, saveTimeSlot } from "@/server/fulfillment/fulfillment-service";

async function requireCateringFulfillmentSession() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    redirect("/dashboard?message=Home catering fulfillment is only for home catering organizations.");
  }
  return session;
}

export async function saveCateringPickupLocationAction(formData: FormData) {
  try {
    const session = await requireCateringFulfillmentSession();
    await savePickupLocation({ session, input: Object.fromEntries(formData) });
    revalidateCateringFulfillment();
    redirect("/catering/fulfillment/pickup?message=Pickup location saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/fulfillment/pickup?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save pickup location."))}`);
  }
}

export async function saveCateringDeliveryZoneAction(formData: FormData) {
  try {
    const session = await requireCateringFulfillmentSession();
    await saveDeliveryZone({ session, input: Object.fromEntries(formData) });
    revalidateCateringFulfillment();
    redirect("/catering/fulfillment/delivery-zones?message=Delivery zone saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/fulfillment/delivery-zones?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save delivery zone."))}`);
  }
}

export async function saveCateringTimeSlotAction(formData: FormData) {
  try {
    const session = await requireCateringFulfillmentSession();
    await saveTimeSlot({ session, input: Object.fromEntries(formData) });
    revalidateCateringFulfillment();
    redirect("/catering/fulfillment/time-slots?message=Time slot saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/catering/fulfillment/time-slots?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save time slot."))}`);
  }
}

function revalidateCateringFulfillment() {
  revalidatePath("/catering/fulfillment");
  revalidatePath("/catering/fulfillment/pickup");
  revalidatePath("/catering/fulfillment/delivery-zones");
  revalidatePath("/catering/fulfillment/time-slots");
}
