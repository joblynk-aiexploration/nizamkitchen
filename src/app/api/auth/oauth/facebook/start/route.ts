import { NextResponse } from "next/server";
import { beginOAuthFlow } from "@/server/auth/oauth-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get("flow") === "register" ? "register" : "login";

  try {
    const authorizationUrl = await beginOAuthFlow({
      provider: "facebook",
      flow,
      redirectTo: url.searchParams.get("redirectTo"),
    });

    return NextResponse.redirect(authorizationUrl, { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Facebook sign-in.";
    return NextResponse.redirect(
      new URL(`/${flow}?message=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
