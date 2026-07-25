import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { FeatureFlagToggle } from "@/components/admin/feature-flag-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { COOKIE_PRIVACY_CONSENT_FEATURE_FLAG } from "@/lib/feature-flags";
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
  const cookiePrivacyFlag = flags.find(
    (flag) => flag.key === COOKIE_PRIVACY_CONSENT_FEATURE_FLAG && !flag.countryCode && !flag.organizationId,
  );

  return (
    <AdminShell
      session={session}
      title="Feature flag control"
      description="Manage future platform modules and rollout scopes at the global, country, and organization levels."
    >
      {cookiePrivacyFlag ? (
        <Card className={cookiePrivacyFlag.enabled ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/80"}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Launch privacy control</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Cookie privacy consent and analytics</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
                Controls Secure Privacy CMP, Google Consent Mode, Google Analytics, and public tracking scripts. Disable this while launching if
                you do not want analytics or cookie-consent widgets showing yet.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm sm:min-w-64">
              <FeatureFlagToggle enabled={cookiePrivacyFlag.enabled} scope="global" />
              <form action={`/api/admin/feature-flags/${cookiePrivacyFlag.id}`} method="post">
                <input type="hidden" name="key" value={cookiePrivacyFlag.key} />
                <input type="hidden" name="name" value={cookiePrivacyFlag.name} />
                <input type="hidden" name="description" value={cookiePrivacyFlag.description ?? ""} />
                <input type="hidden" name="scopeType" value="global" />
                <input type="hidden" name="countryCode" value="" />
                <input type="hidden" name="organizationId" value="" />
                <input type="hidden" name="enabled" value={cookiePrivacyFlag.enabled ? "" : "on"} />
                <Button type="submit" variant={cookiePrivacyFlag.enabled ? "secondary" : "primary"} className="w-full">
                  {cookiePrivacyFlag.enabled ? "Disable cookies and analytics" : "Enable cookies and analytics"}
                </Button>
              </form>
            </div>
          </div>
        </Card>
      ) : null}

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
