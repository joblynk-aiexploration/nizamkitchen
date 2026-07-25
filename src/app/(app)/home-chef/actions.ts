"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { withAnalyticsEvent } from "@/lib/analytics/events";
import { homeChefRequestInputFromForm } from "@/lib/home-chef-request-form";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  canAccessHomeChefs,
  cancelHomeChefRequest,
  createHomeChefRequest,
  createHomeChefRequestMessage,
  isHouseholdRequestOrganization,
  updateHomeChefRequestDraft,
} from "@/server/home-chef";
import { createStripeHomeChefCheckout } from "@/server/payments/providers/stripe/stripe-adapter";
import { createPayPalHomeChefCheckout } from "@/server/payments/providers/paypal/paypal-adapter";
import { createMarketplaceReview, reportMarketplaceReview } from "@/server/trust/review-service";
import { upsertPrimaryLocation } from "@/server/maps/location-service";

async function requireHomeChefHouseholdAccess() {
  const session = await requireMembership();
  const enabled = await canAccessHomeChefs({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    redirect("/home-chef?message=Home chef requests are not enabled for this organization.");
  }

  if (!isHouseholdRequestOrganization(session.activeOrganization.organizationType)) {
    redirect("/dashboard?message=Home chef requests are available only for household organizations.");
  }

  return session;
}

function parseLocationNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createHomeChefRequestAction(formData: FormData) {
  try {
    const session = await requireHomeChefHouseholdAccess();
    const request = await createHomeChefRequest({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      createdById: session.user.id,
      defaultCurrencyCode: session.activeOrganization.currencyCode,
      input: homeChefRequestInputFromForm(formData),
    });
    await upsertPrimaryLocation({
      organizationId: session.activeOrganization.id,
      userId: session.user.id,
      entityType: "home_chef_request",
      entityId: request.id,
      label: "Service address",
      addressLine1: String(formData.get("serviceAddressLine1") ?? ""),
      addressLine2: String(formData.get("serviceAddressLine2") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      countryCode: String(formData.get("locationCountryCode") ?? session.activeOrganization.countryCode),
      postalCode: String(formData.get("postalCode") ?? ""),
      latitude: parseLocationNumber(formData.get("locationLatitude")),
      longitude: parseLocationNumber(formData.get("locationLongitude")),
      providerPlaceId: String(formData.get("locationProviderPlaceId") ?? ""),
    });

    revalidatePath("/home-chef");
    revalidatePath("/home-chef/requests");
    revalidatePath("/chef/requests");
    redirect(withAnalyticsEvent(`/home-chef/requests/${request.id}?message=Home chef request saved.`, "home_chef_request_created"));
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/request?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save request."))}`);
  }
}

export async function updateHomeChefRequestAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefHouseholdAccess();
    await updateHomeChefRequestDraft({
      requestId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      defaultCurrencyCode: session.activeOrganization.currencyCode,
      input: homeChefRequestInputFromForm(formData),
    });
    await upsertPrimaryLocation({
      organizationId: session.activeOrganization.id,
      userId: session.user.id,
      entityType: "home_chef_request",
      entityId: requestId,
      label: "Service address",
      addressLine1: String(formData.get("serviceAddressLine1") ?? ""),
      addressLine2: String(formData.get("serviceAddressLine2") ?? ""),
      city: String(formData.get("city") ?? ""),
      region: String(formData.get("region") ?? ""),
      countryCode: String(formData.get("locationCountryCode") ?? session.activeOrganization.countryCode),
      postalCode: String(formData.get("postalCode") ?? ""),
      latitude: parseLocationNumber(formData.get("locationLatitude")),
      longitude: parseLocationNumber(formData.get("locationLongitude")),
      providerPlaceId: String(formData.get("locationProviderPlaceId") ?? ""),
    });

    revalidatePath(`/home-chef/requests/${requestId}`);
    revalidatePath("/home-chef/requests");
    revalidatePath("/chef/requests");
    redirect(`/home-chef/requests/${requestId}?message=Home chef request updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update request."))}`);
  }
}

export async function cancelHomeChefRequestAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefHouseholdAccess();
    await cancelHomeChefRequest({
      requestId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      note: String(formData.get("note") || "Cancelled by household."),
    });

    revalidatePath(`/home-chef/requests/${requestId}`);
    revalidatePath("/home-chef/requests");
    redirect(`/home-chef/requests/${requestId}?message=Request cancelled.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to cancel request."))}`);
  }
}

export async function createHomeChefMessageAction(formData: FormData) {
  const requestId = String(formData.get("requestId"));

  try {
    const session = await requireHomeChefHouseholdAccess();
    await createHomeChefRequestMessage({
      requestId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      senderRole: "household",
      input: {
        message: formData.get("message"),
        isInternal: false,
      },
    });

    revalidatePath(`/home-chef/requests/${requestId}`);
    redirect(`/home-chef/requests/${requestId}?message=Message sent.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to send message."))}`);
  }
}

export async function createHomeChefCheckoutAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const paymentType = formData.get("paymentType") === "deposit" ? "deposit" : "full";
  const promotionCode = String(formData.get("promoCode") ?? "").trim() || null;
  try {
    const session = await requireHomeChefHouseholdAccess();
    const result = await createStripeHomeChefCheckout({
      requestId,
      userId: session.user.id,
      appUrl: env.APP_URL,
      paymentType,
      promotionCode,
    });
    if (!result.checkoutUrl) throw new Error("Stripe checkout could not be created.");
    redirect(result.checkoutUrl);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create payment link."))}`);
  }
}

export async function createPayPalHomeChefCheckoutAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const paymentType = formData.get("paymentType") === "deposit" ? "deposit" : "full";
  const promotionCode = String(formData.get("promoCode") ?? "").trim() || null;
  try {
    const session = await requireHomeChefHouseholdAccess();
    const result = await createPayPalHomeChefCheckout({
      requestId,
      userId: session.user.id,
      appUrl: env.APP_URL,
      paymentType,
      promotionCode,
    });
    if (!result.checkoutUrl) throw new Error("PayPal checkout could not be created.");
    redirect(result.checkoutUrl);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create PayPal payment link."))}`);
  }
}

export async function createHomeChefReviewAction(formData: FormData) {
  const requestId = String(formData.get("homeChefRequestId") ?? "");
  try {
    const session = await requireHomeChefHouseholdAccess();
    await createMarketplaceReview({ session, input: Object.fromEntries(formData) });
    revalidatePath(`/home-chef/requests/${requestId}`);
    redirect(`/home-chef/requests/${requestId}?message=Review submitted for moderation.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to submit review."))}`);
  }
}

export async function reportHomeChefReviewAction(formData: FormData) {
  const requestId = String(formData.get("homeChefRequestId") ?? "");
  try {
    const session = await requireHomeChefHouseholdAccess();
    await reportMarketplaceReview({ session, input: Object.fromEntries(formData) });
    revalidatePath(`/home-chef/requests/${requestId}`);
    redirect(`/home-chef/requests/${requestId}?message=Review reported.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/home-chef/requests/${requestId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to report review."))}`);
  }
}
