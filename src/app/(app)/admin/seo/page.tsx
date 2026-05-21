import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminSeoPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  return (
    <AdminShell session={session} title="SEO / AEO" description="Search, answer-engine, analytics, and webmaster setup lives under API Management while this workspace is finalized.">
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Configure Google Analytics, Search Console, AdSense, reCAPTCHA, and public metadata from API Management today. A dedicated SEO content workflow can be added here later.
        </p>
      </Card>
    </AdminShell>
  );
}
