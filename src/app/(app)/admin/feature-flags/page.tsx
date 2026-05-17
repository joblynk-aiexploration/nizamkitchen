import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { FeatureFlagToggle } from "@/components/admin/feature-flag-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { listAdminFeatureFlags } from "@/server/admin/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminFeatureFlagsPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const [flags, countries, organizations] = await Promise.all([
    listAdminFeatureFlags(session),
    prisma.country.findMany({
      select: { countryCode: true, countryName: true },
      orderBy: { countryName: "asc" },
    }),
    prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canCreate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Feature flag control"
      description="Manage future platform modules and rollout scopes at the global, country, and organization levels."
    >
      {canCreate ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Create feature flag</h2>
          <form action="/api/admin/feature-flags" method="post" className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <input name="key" placeholder="Flag key" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" required />
            <input name="name" placeholder="Display name" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" required />
            <select name="scopeType" defaultValue="global" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <option value="global">global</option>
              <option value="country">country</option>
              <option value="organization">organization</option>
            </select>
            <select name="countryCode" defaultValue="" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <option value="">No country scope</option>
              {countries.map((country) => (
                <option key={country.countryCode} value={country.countryCode}>
                  {country.countryName}
                </option>
              ))}
            </select>
            <select name="organizationId" defaultValue="" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <option value="">No organization scope</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
              <input type="checkbox" name="enabled" />
              <span>Enabled</span>
            </label>
            <textarea name="description" placeholder="Description" className="min-h-28 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm md:col-span-2 xl:col-span-3" />
            <div className="md:col-span-2 xl:col-span-3">
              <Button type="submit">Create flag</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <AdminDataTable
        data={flags}
        emptyMessage="No feature flags were found."
        columns={[
          {
            key: "flag",
            header: "Flag",
            render: (flag) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{flag.key}</p>
                <p className="text-[var(--color-muted)]">{flag.name}</p>
              </div>
            ),
          },
          {
            key: "scope",
            header: "Scope",
            render: (flag) => (
              <div className="space-y-2">
                <FeatureFlagToggle
                  enabled={flag.enabled}
                  scope={flag.organizationId ? "organization" : flag.countryCode ? "country" : "global"}
                />
                {flag.countryCode ? <CountryBadge countryCode={flag.countryCode} /> : null}
                {flag.organization ? <p className="text-[var(--color-muted)]">{flag.organization.name}</p> : null}
              </div>
            ),
          },
          {
            key: "description",
            header: "Description",
            render: (flag) => (
              <p className="text-[var(--color-muted)]">{flag.description ?? "No description provided."}</p>
            ),
          },
          {
            key: "actions",
            header: "Update",
            render: (flag) => (
              <form action={`/api/admin/feature-flags/${flag.id}`} method="post" className="space-y-2">
                <input type="hidden" name="key" value={flag.key} />
                <input type="hidden" name="name" value={flag.name} />
                <input type="hidden" name="description" value={flag.description ?? ""} />
                <input
                  type="hidden"
                  name="scopeType"
                  value={flag.organizationId ? "organization" : flag.countryCode ? "country" : "global"}
                />
                <input type="hidden" name="countryCode" value={flag.countryCode ?? ""} />
                <input type="hidden" name="organizationId" value={flag.organizationId ?? ""} />
                <input type="hidden" name="enabled" value={flag.enabled ? "" : "on"} />
                <Button type="submit" variant={flag.enabled ? "secondary" : "primary"}>
                  {flag.enabled ? "Disable" : "Enable"}
                </Button>
              </form>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
