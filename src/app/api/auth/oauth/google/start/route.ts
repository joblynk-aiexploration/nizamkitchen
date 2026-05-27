import { NextResponse } from "next/server";
import { getPublicRequestOrigin, publicRedirectUrl } from "@/lib/request-origin";
import { beginOAuthFlow, getOAuthUserFacingErrorMessage } from "@/server/auth/oauth-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get("flow") === "register" ? "register" : "login";

  try {
    const authorizationUrl = await beginOAuthFlow({
      provider: "google",
      flow,
      redirectTo: url.searchParams.get("redirectTo"),
      selectedPlanSlug: url.searchParams.get("plan"),
      requestOrigin: getPublicRequestOrigin(request),
    });

    return NextResponse.redirect(authorizationUrl, { status: 302 });
  } catch (error) {
    const message = getOAuthUserFacingErrorMessage(error, "Unable to start Google sign-in.");
    return NextResponse.redirect(
      publicRedirectUrl(`/${flow}?message=${encodeURIComponent(message)}`, request),
      { status: 303 },
    );
  }
}
