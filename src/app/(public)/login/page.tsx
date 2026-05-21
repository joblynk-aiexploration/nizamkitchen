import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { RecaptchaField } from "@/components/seo/recaptcha-field";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextInput } from "@/components/ui/text-input";
import { listVisibleSocialAuthProvidersSafe } from "@/server/auth/oauth-service";
import { getRecaptchaConfig } from "@/server/seo/seo-service";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;
  const [socialProviders, recaptcha] = await Promise.all([
    listVisibleSocialAuthProvidersSafe("login"),
    getRecaptchaConfig(),
  ]);

  return (
    <AuthShell
      title="Sign in"
      description="Use your platform credentials to access the NizamKitchen control plane."
      footer={
        <span>
          Need an account?{" "}
          <Link className="font-semibold text-[var(--color-primary)]" href="/register">
            Create one
          </Link>
        </span>
      }
    >
      <FormMessage message={message} />
      <SocialAuthButtons providers={socialProviders} />
      <form action="/api/auth/login" method="post" className="space-y-4">
        <TextInput
          label="Email address"
          name="email"
          type="email"
          required
          placeholder="Enter Email Address"
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          required
          placeholder="Enter Password"
        />
        <RecaptchaField siteKey={recaptcha?.siteKey} action="login" />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
