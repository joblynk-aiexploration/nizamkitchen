import { NextResponse } from "next/server";
import { finishOAuthCallback } from "@/server/auth/oauth-service";

export async function GET(request: Request) {
  try {
    const redirectPath = await finishOAuthCallback({
      provider: "google",
      requestUrl: request.url,
    });

    return NextResponse.redirect(new URL(redirectPath, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete Google sign-in.";
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
