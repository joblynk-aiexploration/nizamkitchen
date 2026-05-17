import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applySecurityHeaders, createRequestId } from "@/lib/security";

const protectedPrefixes = [
  "/dashboard",
  "/organizations",
  "/team",
  "/settings",
  "/audit-logs",
  "/billing",
  "/developer",
  "/admin",
];

const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "nk_session";

export function middleware(request: NextRequest) {
  const requestId = createRequestId();
  const pathname = request.nextUrl.pathname;
  const hasSessionCookie = !!request.cookies.get(sessionCookieName)?.value;

  if (
    protectedPrefixes.some((prefix) => pathname.startsWith(prefix)) &&
    !hasSessionCookie
  ) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("message", "Please sign in.");

    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("X-Request-Id", requestId);
    return applySecurityHeaders(response);
  }

  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
