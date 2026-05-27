import { NextResponse } from "next/server";
import { publicRedirectUrl } from "@/lib/request-origin";
import { getCurrentSession } from "@/lib/session";
import {
  completeSocialOnboarding,
  getOAuthUserFacingErrorMessage,
  type SocialAccountType,
} from "@/server/auth/oauth-service";

function normalizeAccountType(value: FormDataEntryValue | null): SocialAccountType {
  if (value === "chef" || value === "catering" || value === "restaurant") {
    return value;
  }

  return "household";
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.redirect(publicRedirectUrl("/login?message=Sign in first.", request), { status: 303 });
  }

  if (session.activeMembership && session.activeOrganization) {
    return NextResponse.redirect(publicRedirectUrl("/dashboard", request), { status: 303 });
  }

  const formData = await request.formData();
  const acceptLegalTerms = formData.get("acceptLegalTerms") === "on";

  if (!acceptLegalTerms) {
    return NextResponse.redirect(
      publicRedirectUrl("/onboarding/social?message=Please accept the required legal documents.", request),
      { status: 303 },
    );
  }

  try {
    const destination = await completeSocialOnboarding({
      userId: session.user.id,
      sessionId: session.id,
      fullName: String(formData.get("fullName") ?? session.user.fullName),
      accountType: normalizeAccountType(formData.get("accountType")),
      organizationName: String(formData.get("organizationName") ?? ""),
      countryCode: String(formData.get("countryCode") ?? ""),
      selectedPlanSlug: String(formData.get("selectedPlanSlug") ?? ""),
    });

    if (destination.startsWith("https://checkout.stripe.com/")) {
      return NextResponse.redirect(destination, { status: 303 });
    }

    return NextResponse.redirect(publicRedirectUrl(destination, request), { status: 303 });
  } catch (error) {
    const message = getOAuthUserFacingErrorMessage(error, "Unable to finish social registration.");
    return NextResponse.redirect(
      publicRedirectUrl(`/onboarding/social?message=${encodeURIComponent(message)}`, request),
      { status: 303 },
    );
  }
}
