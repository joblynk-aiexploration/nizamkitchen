"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership, requirePlatformRole, getRequestMetadata } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  acceptSellerAttestation,
  reviewFoodSafetyCertificate,
  reviewKitchenSafetyChecklist,
  reviewSellerPermit,
  reviewSellerVerificationItem,
  reviewSellerVerificationProfile,
  submitKitchenSafetyPhoto,
  submitFoodSafetyCertificate,
  submitSellerPermit,
  submitSellerVerificationDocument,
  submitSellerVerificationForReview,
  upsertSellerTrialReview,
  upsertSellerVerificationRequirement,
} from "@/server/seller-verifications";

function sellerPathForCurrent(pathname: string) {
  if (pathname.includes("/chef/")) return "/chef/verification";
  if (pathname.includes("/restaurant/")) return "/restaurant/verification";
  return "/catering/verification";
}

export async function submitSellerDocumentAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const redirectPath = returnTo || sellerPathForCurrent(returnTo);
  try {
    const session = await requireMembership();
    await submitSellerVerificationDocument(session, {
      requirementId: formData.get("requirementId"),
      requirementType: formData.get("requirementType"),
      documentFileId: formData.get("documentFileId"),
      expiresAt: formData.get("expiresAt"),
    });
    revalidatePath(redirectPath);
    redirect(`${redirectPath}?message=Document submitted for review.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${redirectPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to submit document."))}`);
  }
}

export async function submitFoodSafetyCertificateAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const redirectPath = returnTo || sellerPathForCurrent(returnTo);
  try {
    const session = await requireMembership();
    await submitFoodSafetyCertificate(session, Object.fromEntries(formData.entries()));
    revalidatePath(redirectPath);
    redirect(`${redirectPath}?message=Food safety certificate submitted.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${redirectPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to submit certificate."))}`);
  }
}

export async function submitSellerPermitAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const redirectPath = returnTo || sellerPathForCurrent(returnTo);
  try {
    const session = await requireMembership();
    await submitSellerPermit(session, Object.fromEntries(formData.entries()));
    revalidatePath(redirectPath);
    redirect(`${redirectPath}?message=Permit submitted.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${redirectPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to submit permit."))}`);
  }
}

export async function acceptSellerAttestationAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const redirectPath = returnTo || sellerPathForCurrent(returnTo);
  try {
    const session = await requireMembership();
    await acceptSellerAttestation(session, {
      attestationType: formData.get("attestationType"),
      version: formData.get("version"),
      textSnapshot: formData.get("textSnapshot"),
    }, await getRequestMetadata());
    revalidatePath(redirectPath);
    redirect(`${redirectPath}?message=Attestation accepted.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${redirectPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to accept attestation."))}`);
  }
}

export async function submitKitchenPhotoAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const redirectPath = returnTo || sellerPathForCurrent(returnTo);
  try {
    const session = await requireMembership();
    await submitKitchenSafetyPhoto(session, {
      fileId: formData.get("fileId"),
      category: formData.get("category"),
      caption: formData.get("caption"),
    });
    revalidatePath(redirectPath);
    redirect(`${redirectPath}?message=Kitchen photo submitted.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${redirectPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to submit kitchen photo."))}`);
  }
}

export async function submitSellerVerificationAction(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "");
  const redirectPath = returnTo || sellerPathForCurrent(returnTo);
  try {
    const session = await requireMembership();
    await submitSellerVerificationForReview(session);
    revalidatePath(redirectPath);
    redirect(`${redirectPath}?message=Verification submitted for admin review.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${redirectPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to submit verification."))}`);
  }
}

export async function upsertSellerRequirementAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
    await upsertSellerVerificationRequirement(session, Object.fromEntries(formData.entries()));
    revalidatePath("/admin/verifications/requirements");
    redirect("/admin/verifications/requirements?message=Requirement saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/verifications/requirements?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save requirement."))}`);
  }
}

export async function reviewVerificationItemAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
    await reviewSellerVerificationItem(session, Object.fromEntries(formData.entries()));
    revalidatePath(`/admin/verifications/${profileId}`);
    redirect(`/admin/verifications/${profileId}?message=Item reviewed.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/verifications/${profileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to review item."))}`);
  }
}

export async function reviewVerificationProfileAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
    await reviewSellerVerificationProfile(session, Object.fromEntries(formData.entries()));
    revalidatePath("/admin/verifications");
    revalidatePath(`/admin/verifications/${profileId}`);
    redirect(`/admin/verifications/${profileId}?message=Profile reviewed.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/verifications/${profileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to review profile."))}`);
  }
}

export async function reviewFoodSafetyCertificateAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
    await reviewFoodSafetyCertificate(session, Object.fromEntries(formData.entries()));
    revalidatePath(`/admin/verifications/${profileId}`);
    redirect(`/admin/verifications/${profileId}?message=Certificate reviewed.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/verifications/${profileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to review certificate."))}`);
  }
}

export async function reviewSellerPermitAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
    await reviewSellerPermit(session, Object.fromEntries(formData.entries()));
    revalidatePath(`/admin/verifications/${profileId}`);
    redirect(`/admin/verifications/${profileId}?message=Permit reviewed.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/verifications/${profileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to review permit."))}`);
  }
}

export async function reviewKitchenChecklistAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
    await reviewKitchenSafetyChecklist(session, Object.fromEntries(formData.entries()));
    revalidatePath(`/admin/verifications/${profileId}`);
    redirect(`/admin/verifications/${profileId}?message=Kitchen review updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/verifications/${profileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update kitchen review."))}`);
  }
}

export async function upsertTrialReviewAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
    await upsertSellerTrialReview(session, Object.fromEntries(formData.entries()));
    revalidatePath(`/admin/verifications/${profileId}`);
    redirect(`/admin/verifications/${profileId}?message=Trial review updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/verifications/${profileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update trial review."))}`);
  }
}
