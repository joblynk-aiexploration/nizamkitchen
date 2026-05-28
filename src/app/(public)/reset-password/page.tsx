import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextInput } from "@/components/ui/text-input";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;
  const token = typeof params.token === "string" ? params.token : "";
  const hasToken = token.length > 0;

  return (
    <AuthShell
      title="Create a new password"
      description="Choose a strong password. After it is changed, any existing sessions for this account will be signed out."
      variant="password-recovery"
      footer={
        <span>
          Need a fresh link?{" "}
          <Link className="font-semibold text-[var(--color-primary)]" href="/forgot-password">
            Request another reset
          </Link>
        </span>
      }
    >
      <FormMessage message={message} />
      {hasToken ? (
        <form action="/api/auth/reset-password" method="post" className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <TextInput
            label="New password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Enter a new password"
            hint="Use at least 8 characters with uppercase, lowercase, and a number."
          />
          <TextInput
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Re-enter the new password"
          />
          <Button type="submit" className="w-full">
            Reset password
          </Button>
        </form>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This reset link is missing or incomplete. Please request a new password reset link.
        </div>
      )}
    </AuthShell>
  );
}
