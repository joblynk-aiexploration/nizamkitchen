import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLocalizationPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  return (
    <AdminShell session={session} title="Localization" description="Country, region, language, currency, and local-market setup overview.">
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Country records and country-scoped APIs are active now. Translation and region-specific copy management will be added here when ready.
        </p>
      </Card>
    </AdminShell>
  );
}
