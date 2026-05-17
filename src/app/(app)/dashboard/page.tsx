import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { RoleBadge } from "@/components/ui/role-badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireMembership();
  const [teamCount, auditCount, enabledFlags, countries] = await Promise.all([
    prisma.membership.count({
      where: { organizationId: session.activeOrganization.id, status: "active" },
    }),
    prisma.auditLog.count({
      where: { organizationId: session.activeOrganization.id },
    }),
    prisma.featureFlag.count({
      where: {
        OR: [
          { organizationId: session.activeOrganization.id, enabled: true },
          { organizationId: null, enabled: true },
        ],
      },
    }),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { countryName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace overview"
        title={session.activeOrganization.name}
        description="This dashboard is the control surface for tenant-safe operations, country-aware setup, and future module enablement."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Members" value={teamCount} hint="Active users in the current organization." />
        <MetricCard label="Audit Events" value={auditCount} hint="Tenant-scoped events captured for this workspace." />
        <MetricCard label="Enabled Flags" value={enabledFlags} hint="Feature toggles active for this tenant or globally." />
        <MetricCard label="Country" value={session.activeOrganization.countryCode} hint="Primary tenant operating country." />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="text-xl font-semibold">Current tenant context</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Organization status</p>
              <div className="mt-2">
                <Badge tone="success">{session.activeOrganization.status}</Badge>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Your role</p>
              <div className="mt-2">
                <RoleBadge value={session.activeMembership.role} />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Country coverage</p>
              <div className="mt-2">
                <CountryBadge
                  countryCode={session.activeOrganization.countryCode}
                  countryName={session.activeOrganization.country.countryName}
                />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Measurement system</p>
              <div className="mt-2">
                <Badge tone="neutral">{session.activeOrganization.measurementSystem}</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Supported rollout countries</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {countries.map((country) => (
              <CountryBadge
                key={country.id}
                countryCode={country.countryCode}
                countryName={country.countryName}
              />
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
