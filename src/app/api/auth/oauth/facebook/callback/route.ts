import { NextResponse } from "next/server";
import { getPublicRequestOrigin, publicRedirectUrl } from "@/lib/request-origin";
import { finishOAuthCallback, getOAuthUserFacingErrorMessage } from "@/server/auth/oauth-service";

export async function GET(request: Request) {
  try {
    const redirectPath = await finishOAuthCallback({
      provider: "facebook",
      requestUrl: request.url,
      requestOrigin: getPublicRequestOrigin(request),
    });

    return NextResponse.redirect(publicRedirectUrl(redirectPath, request), { status: 303 });
  } catch (error) {
    const message = getOAuthUserFacingErrorMessage(error, "Unable to complete Facebook sign-in.");
    return NextResponse.redirect(
      publicRedirectUrl(`/login?message=${encodeURIComponent(message)}`, request),
      { status: 303 },
    );
  }
}
