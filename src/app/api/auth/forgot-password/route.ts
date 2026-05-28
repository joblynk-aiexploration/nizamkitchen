import { NextResponse } from "next/server";
import { enforceRateLimit, getClientIpFromHeaders, rateLimitPolicies } from "@/lib/security";
import { getRequestMetadata } from "@/lib/session";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/server/auth/password-reset-service";
import { verifyRecaptcha } from "@/server/seo/seo-service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientIp = getClientIpFromHeaders(request.headers);

  try {
    enforceRateLimit({
      key: `password-reset:${clientIp}:${formData.get("email")?.toString().toLowerCase() ?? ""}`,
      ...rateLimitPolicies.passwordReset,
    });
  } catch {
    return redirectAfterPost(new URL("/forgot-password?message=Too many requests. Please wait a minute and try again.", request.url));
  }

  const recaptcha = await verifyRecaptcha({
    token: formData.get("recaptchaToken")?.toString(),
    page: "forgot-password",
    ip: clientIp,
  });
  if (!recaptcha.ok) {
    return redirectAfterPost(new URL(`/forgot-password?message=${encodeURIComponent(recaptcha.reason)}`, request.url));
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return redirectAfterPost(new URL("/forgot-password?message=Enter a valid email address.", request.url));
  }

  const result = await requestPasswordReset(parsed.data.email, request, await getRequestMetadata());
  return redirectAfterPost(new URL(`/forgot-password?message=${encodeURIComponent(result.message)}`, request.url));
}

function redirectAfterPost(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
}
