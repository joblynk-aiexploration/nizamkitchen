import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FEATURE_REGISTRY } from "@/lib/feature-flags";
import { getFeatureDetail } from "@/server/admin/feature-flags";

export const dynamic = "force-dynamic";

const ORG_TYPE_ORDER = [
  "household",
  "chef_business",
  "home_catering",
  "restaurant",
  "grocery_partner",
  "internal_admin",
] as const;

const ORG_TYPE_META: Record<string, { label: string; icon: string; description: string }> = {
  household:      { label: "Household Accounts",       icon: "🏠", description: "Family and personal kitchen accounts" },
  chef_business:  { label: "Home Chef Accounts",       icon: "👨‍🍳", description: "Independent home chef businesses" },
  home_catering:  { label: "Home Catering Accounts",   icon: "🍽️", description: "Event catering service providers" },
  restaurant:     { label: "Restaurant Accounts",      icon: "🏪", description: "Restaurant and food outlet businesses" },
  grocery_partner:{ label: "Grocery Partner Accounts", icon: "🛒", description: "Grocery delivery integration partners" },
  internal_admin: { label: "Internal Admin Accounts",  icon: "⚙️", description: "Platform administration and tooling" },
};

type OrgEntry = Awaited<ReturnType<typeof getFeatureDetail>>["grouped"] extends Map<string, infer T> ? T[number] : never;

function GlobalStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
      enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
    }`}>
      <span className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-slate-400"}`} />
      {enabled ? "Enabled globally" : "Disabled globally"}
    </span>
  );
}

function RowStatusBadge({ enabled, hasOverride }: { enabled: boolean; hasOverride: boolean }) {
  if (enabled) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        hasOverride ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "bg-emerald-50 text-emerald-600"
      }`}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {hasOverride ? "Enabled (override)" : "Enabled"}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
      hasOverride ? "bg-red-50 text-red-500 ring-1 ring-red-200" : "bg-slate-100 text-slate-400"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${hasOverride ? "bg-red-400" : "bg-slate-400"}`} />
      {hasOverride ? "Disabled (override)" : "Disabled"}
    </span>
  );
}

function OrgTable({
  orgs,
  featureKey,
  canMutate,
}: {
  orgs: OrgEntry[];
  featureKey: string;
  canMutate: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
      {/* Table header */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(100px,auto)_minmax(180px,auto)] items-center border-b border-[var(--color-border)] bg-slate-50/80 px-5 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Account</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Owner</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Status</span>
        {canMutate && <span className="text-right text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Actions</span>}
      </div>

      {/* Rows */}
      {orgs.map((org, i) => (
        <div
          key={org.id}
          className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(100px,auto)_minmax(180px,auto)] items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/60 ${
            i > 0 ? "border-t border-[var(--color-border)]" : ""
          } ${org.effectiveEnabled ? "" : "opacity-70"}`}
        >
          {/* Account */}
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-[var(--color-ink)]">{org.name}</span>
            <span className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{org.slug}</span>
            <span className="mt-1 text-[11px] text-slate-400">
              {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
              {" · "}
              {org.countryCode}
            </span>
          </div>

          {/* Owner */}
          <div className="flex min-w-0 flex-col">
            {org.ownerName ? (
              <>
                <span className="truncate text-sm font-medium text-[var(--color-ink)]">{org.ownerName}</span>
                <span className="mt-0.5 truncate text-xs text-[var(--color-muted)]">{org.ownerEmail}</span>
              </>
            ) : (
              <span className="text-xs text-slate-400">No owner assigned</span>
            )}
          </div>

          {/* Status */}
          <div>
            <RowStatusBadge enabled={org.effectiveEnabled} hasOverride={org.override !== null} />
          </div>

          {/* Actions */}
          {canMutate && (
            <div className="flex items-center justify-end gap-2">
              <form action="/api/admin/feature-flags/org" method="post">
                <input type="hidden" name="key" value={featureKey} />
                <input type="hidden" name="organizationId" value={org.id} />
                <input type="hidden" name="enabled" value={org.effectiveEnabled ? "false" : "true"} />
                <Button
                  type="submit"
                  variant={org.effectiveEnabled ? "secondary" : "primary"}
                >
                  {org.effectiveEnabled ? "Disable" : "Enable"}
                </Button>
              </form>

              {org.override ? (
                <form action={`/api/admin/feature-flags/${org.override.id}/remove`} method="post">
                  <button
                    type="submit"
                    className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition-all hover:bg-slate-50"
                    title="Remove org-specific override — revert to global setting"
                  >
                    Reset to global
                  </button>
                </form>
              ) : (
                <span className="w-[96px]" /> /* spacer to keep alignment */
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function FeatureFlagDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { key } = await params;
  const query = await searchParams;

  if (!FEATURE_REGISTRY.find((f) => f.key === key)) notFound();

  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);

  const { feature, globalFlag, grouped } = await getFeatureDetail(session, key);
  const canMutate =
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin";

  const globalEnabled = globalFlag?.enabled ?? false;

  // Overall counts
  const allOrgs = ORG_TYPE_ORDER.flatMap((t) => grouped.get(t) ?? []);
  const enabledTotal = allOrgs.filter((o) => o.effectiveEnabled).length;
  const overrideTotal = allOrgs.filter((o) => o.override !== null).length;

  return (
    <AdminShell
      session={session}
      title={feature.name}
      description={feature.description}
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/feature-flags">← All features</Link>
        </Button>
      }
    >
      {query.message ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <span className="text-base">✓</span>
          {query.message}
        </div>
      ) : null}

      {/* Global control panel */}
      <Card className={`border-2 ${globalEnabled ? "border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white" : "border-slate-200 bg-gradient-to-br from-slate-50/80 to-white"}`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Status + stats */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <GlobalStatusBadge enabled={globalEnabled} />
              <span className="text-xs text-[var(--color-muted)]">
                Feature key: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{key}</code>
              </span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--color-ink)]">{enabledTotal}</span>
                <span className="text-xs text-[var(--color-muted)]">accounts enabled</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--color-ink)]">{allOrgs.length - enabledTotal}</span>
                <span className="text-xs text-[var(--color-muted)]">accounts disabled</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--color-ink)]">{overrideTotal}</span>
                <span className="text-xs text-[var(--color-muted)]">org-level overrides</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-[var(--color-ink)]">{allOrgs.length}</span>
                <span className="text-xs text-[var(--color-muted)]">total accounts</span>
              </div>
            </div>
          </div>

          {/* Global toggle buttons */}
          {canMutate && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <form action="/api/admin/feature-flags/global" method="post">
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="enabled" value="true" />
                <Button
                  type="submit"
                  variant={globalEnabled ? "secondary" : "primary"}
                  className="w-full sm:w-auto"
                  disabled={globalEnabled}
                >
                  Enable for all accounts
                </Button>
              </form>
              <form action="/api/admin/feature-flags/global" method="post">
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="enabled" value="false" />
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  disabled={!globalEnabled}
                >
                  Disable for all accounts
                </Button>
              </form>
            </div>
          )}
        </div>
      </Card>

      {/* Per-account sections, grouped by org type */}
      {ORG_TYPE_ORDER.map((orgType) => {
        const orgs = grouped.get(orgType) ?? [];
        if (orgs.length === 0) return null;

        const meta = ORG_TYPE_META[orgType];
        const enabledCount = orgs.filter((o) => o.effectiveEnabled).length;
        const hasOverrides = orgs.some((o) => o.override !== null);

        return (
          <section key={orgType}>
            {/* Section header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{meta.icon}</span>
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-ink)]">{meta.label}</h2>
                  <p className="text-xs text-[var(--color-muted)]">{meta.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasOverrides && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
                    {orgs.filter((o) => o.override !== null).length} override{orgs.filter((o) => o.override !== null).length !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {enabledCount} / {orgs.length} enabled
                </span>
              </div>
            </div>

            <OrgTable orgs={orgs} featureKey={key} canMutate={canMutate} />
          </section>
        );
      })}
    </AdminShell>
  );
}
