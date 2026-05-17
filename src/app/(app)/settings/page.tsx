import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireMembership();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Organization settings"
        description="This foundation keeps tenant metadata explicit so upcoming modules can inherit locale, timezone, billing, and country behavior safely."
      />
      <Card>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Organization</p>
            <p className="mt-2 text-lg font-semibold">{session.activeOrganization.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Slug</p>
            <p className="mt-2 text-lg font-semibold">{session.activeOrganization.slug}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge value={session.activeOrganization.status} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Country</p>
            <div className="mt-2">
              <CountryBadge
                countryCode={session.activeOrganization.countryCode}
                countryName={session.activeOrganization.country.countryName}
              />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Timezone</p>
            <p className="mt-2 text-lg font-semibold">{session.activeOrganization.defaultTimezone}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Locale</p>
            <p className="mt-2 text-lg font-semibold">{session.activeOrganization.defaultLocale}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
