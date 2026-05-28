import { NextResponse } from "next/server";
import { enforceRateLimit, getClientIpFromHeaders, rateLimitPolicies } from "@/lib/security";
import { getRequestMetadata } from "@/lib/session";
import { getPasswordResetValidationMessage, resetPasswordSchema } from "@/lib/validation/auth";
import { resetPasswordWithToken } from "@/server/auth/password-reset-service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const clientIp = getClientIpFromHeaders(request.headers);

  try {
    enforceRateLimit({
      key: `password-reset-complete:${clientIp}`,
      ...rateLimitPolicies.passwordReset,
    });
  } catch {
    return redirectAfterPost(new URL("/reset-password?message=Too many requests. Please wait a minute and try again.", request.url));
  }

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const token = formData.get("token")?.toString() ?? "";
    return redirectAfterPost(
      new URL(`/reset-password?token=${encodeURIComponent(token)}&message=${encodeURIComponent(getPasswordResetValidationMessage(parsed.error))}`, request.url),
    );
  }

  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password, await getRequestMetadata());
  if (!result.ok) {
    return redirectAfterPost(
      new URL(`/reset-password?token=${encodeURIComponent(parsed.data.token)}&message=${encodeURIComponent(result.message)}`, request.url),
    );
  }

  return redirectAfterPost(new URL(`/login?message=${encodeURIComponent(result.message)}`, request.url));
}

function redirectAfterPost(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
}
