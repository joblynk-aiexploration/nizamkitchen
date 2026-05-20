import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { completeSocialOnboarding, type SocialAccountType } from "@/server/auth/oauth-service";

function normalizeAccountType(value: FormDataEntryValue | null): SocialAccountType {
  if (value === "chef" || value === "catering" || value === "restaurant") {
    return value;
  }

  return "household";
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login?message=Sign in first.", request.url), { status: 303 });
  }

  if (session.activeMembership && session.activeOrganization) {
    return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
  }

  const formData = await request.formData();
  const acceptLegalTerms = formData.get("acceptLegalTerms") === "on";

  if (!acceptLegalTerms) {
    return NextResponse.redirect(
      new URL("/onboarding/social?message=Please accept the required legal documents.", request.url),
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
    });

    return NextResponse.redirect(new URL(destination, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish social registration.";
    return NextResponse.redirect(
      new URL(`/onboarding/social?message=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
