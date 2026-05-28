import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecaptchaField } from "@/components/seo/recaptcha-field";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextInput } from "@/components/ui/text-input";
import { getRecaptchaConfig } from "@/server/seo/seo-service";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;
  const recaptcha = await getRecaptchaConfig().catch(() => null);

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email address and we will send you a secure link to create a new password."
      variant="password-recovery"
      footer={
        <span>
          Remembered your password?{" "}
          <Link className="font-semibold text-[var(--color-primary)]" href="/login">
            Sign in
          </Link>
        </span>
      }
    >
      <FormMessage message={message} />
      <form action="/api/auth/forgot-password" method="post" className="space-y-4">
        <TextInput
          label="Email address"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <RecaptchaField siteKey={recaptcha?.siteKey} action="forgot-password" />
        <Button type="submit" className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
