import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FEATURE_REGISTRY } from "@/lib/feature-flags";
import { getFeatureDetail } from "@/server/admin/feature-flags";

export const dynamic = "force-dynamic";

const ORG_TYPE_LABELS: Record<string, string> = {
  household: "Household Accounts",
  chef_business: "Home Chef Accounts",
  home_catering: "Home Catering Accounts",
  restaurant: "Restaurant Accounts",
  grocery_partner: "Grocery Partner Accounts",
  internal_admin: "Internal Admin Accounts",
};

const ORG_TYPE_ORDER = [
  "household",
  "chef_business",
  "home_catering",
  "restaurant",
  "grocery_partner",
  "internal_admin",
];

function EffectiveBadge({ enabled, hasOverride }: { enabled: boolean; hasOverride: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        {hasOverride ? "Disabled (override)" : "Disabled (global)"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {hasOverride ? "Enabled (override)" : "Enabled (global)"}
    </span>
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

  return (
    <AdminShell
      session={session}
      title={feature.name}
      description={feature.description}
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/feature-flags">Back to feature flags</Link>
        </Button>
      }
    >
      {query.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {query.message}
        </div>
      ) : null}

      {/* Global controls */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">Global setting</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Applies to all accounts that do not have an individual override set below.
            </p>
            <div className="mt-3">
              <EffectiveBadge enabled={globalEnabled} hasOverride={false} />
            </div>
          </div>
          {canMutate ? (
            <div className="flex shrink-0 gap-2">
              <form action="/api/admin/feature-flags/global" method="post">
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="enabled" value="true" />
                <Button type="submit" variant={globalEnabled ? "secondary" : "primary"} disabled={globalEnabled}>
                  Enable for all
                </Button>
              </form>
              <form action="/api/admin/feature-flags/global" method="post">
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="enabled" value="false" />
                <Button type="submit" variant={!globalEnabled ? "secondary" : "danger"} disabled={!globalEnabled}>
                  Disable for all
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Per-org sections, grouped by type */}
      {ORG_TYPE_ORDER.map((orgType) => {
        const orgs = grouped.get(orgType) ?? [];
        if (orgs.length === 0) return null;

        const enabledCount = orgs.filter((o) => o.effectiveEnabled).length;

        return (
          <div key={orgType}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-base font-semibold text-[var(--color-ink)]">
                {ORG_TYPE_LABELS[orgType] ?? orgType}
              </h2>
              <span className="text-xs text-[var(--color-muted)]">
                {enabledCount} of {orgs.length} enabled
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
              <div className="grid grid-cols-[1fr_auto_auto] border-b border-[var(--color-border)] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span>Account</span>
                <span className="text-right">Status</span>
                {canMutate ? <span className="pl-4 text-right">Actions</span> : null}
              </div>

              {orgs.map((org, i) => (
                <div
                  key={org.id}
                  className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm ${i > 0 ? "border-t border-[var(--color-border)]" : ""}`}
                >
                  {/* Account name */}
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{org.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">{org.slug}</p>
                  </div>

                  {/* Status */}
                  <div className="text-right">
                    <EffectiveBadge enabled={org.effectiveEnabled} hasOverride={org.override !== null} />
                  </div>

                  {/* Actions */}
                  {canMutate ? (
                    <div className="flex items-center gap-2 pl-4">
                      {/* Toggle: flip the current effective state */}
                      <form action="/api/admin/feature-flags/org" method="post">
                        <input type="hidden" name="key" value={key} />
                        <input type="hidden" name="organizationId" value={org.id} />
                        <input type="hidden" name="enabled" value={org.effectiveEnabled ? "false" : "true"} />
                        <button
                          type="submit"
                          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition hover:opacity-90 ${
                            org.effectiveEnabled
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {org.effectiveEnabled ? "Disable" : "Enable"}
                        </button>
                      </form>

                      {/* Remove override — only shows when an org-specific override exists */}
                      {org.override ? (
                        <form action={`/api/admin/feature-flags/${org.override.id}/remove`} method="post">
                          <button
                            type="submit"
                            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-200"
                            title="Remove override — revert to global setting"
                          >
                            Reset to global
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </AdminShell>
  );
}
