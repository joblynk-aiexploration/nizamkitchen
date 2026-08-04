import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listFeatureRegistry } from "@/server/admin/feature-flags";

export const dynamic = "force-dynamic";

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        enabled
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

export default async function AdminFeatureFlagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);
  const params = await searchParams;
  const features = await listFeatureRegistry(session);
  const canMutate =
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Feature flags"
      description="All available platform features. Enable or disable each feature globally for all organizations, or manage per-organization overrides."
    >
      {params.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {params.message}
        </div>
      ) : null}

      <div className="grid gap-5">
        {features.map((feature) => {
          const globalEnabled = feature.globalFlag?.enabled ?? false;
          const enabledOverrides = feature.orgOverrides.filter((o) => o.enabled).length;
          const disabledOverrides = feature.orgOverrides.filter((o) => !o.enabled).length;

          return (
            <Card key={feature.key}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                {/* Left: info */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/admin/feature-flags/${feature.key}`}
                      className="text-base font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)] hover:underline underline-offset-2"
                    >
                      {feature.name}
                    </Link>
                    <StatusPill enabled={globalEnabled} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                      {feature.scope === "global" ? "platform-wide" : "per-org"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{feature.description}</p>
                  <p className="mt-3 font-mono text-xs text-slate-400">{feature.key}</p>

                  {/* Org override summary */}
                  {feature.scope === "org" && (
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-muted)]">
                      <span>
                        <span className="font-semibold text-emerald-600">{enabledOverrides}</span>{" "}
                        org{enabledOverrides !== 1 ? "s" : ""} explicitly enabled
                      </span>
                      <span>
                        <span className="font-semibold text-slate-500">{disabledOverrides}</span>{" "}
                        org{disabledOverrides !== 1 ? "s" : ""} explicitly disabled
                      </span>
                      <span>
                        {feature.totalOrgs - feature.orgOverrides.length} org{feature.totalOrgs - feature.orgOverrides.length !== 1 ? "s" : ""} inheriting global
                      </span>
                    </div>
                  )}

                  {/* View accounts link */}
                  {feature.scope === "org" && (
                    <div className="mt-3">
                      <Link
                        href={`/admin/feature-flags/${feature.key}`}
                        className="text-xs font-medium text-[var(--color-primary)] hover:underline underline-offset-2"
                      >
                        View &amp; manage per-account →
                      </Link>
                    </div>
                  )}

                  {/* Per-org overrides */}
                  {feature.orgOverrides.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {feature.orgOverrides.map((override) => (
                        <div
                          key={override.id}
                          className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-slate-50 px-3 py-1.5 text-xs"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${override.enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
                          <span className="font-medium text-[var(--color-ink)]">{override.organizationName}</span>
                          {canMutate ? (
                            <form action={`/api/admin/feature-flags/${override.id}`} method="post" className="inline">
                              <input type="hidden" name="key" value={feature.key} />
                              <input type="hidden" name="name" value={feature.name} />
                              <input type="hidden" name="description" value={feature.description} />
                              <input type="hidden" name="scopeType" value="organization" />
                              <input type="hidden" name="countryCode" value="" />
                              <input type="hidden" name="organizationId" value={override.organizationId} />
                              <input type="hidden" name="enabled" value={override.enabled ? "" : "on"} />
                              <button
                                type="submit"
                                className="ml-1 text-[var(--color-primary)] underline-offset-2 hover:underline"
                              >
                                {override.enabled ? "disable" : "enable"}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: global controls */}
                {canMutate ? (
                  <div className="flex shrink-0 flex-col gap-2 lg:min-w-52">
                    <form action="/api/admin/feature-flags/global" method="post">
                      <input type="hidden" name="key" value={feature.key} />
                      <input type="hidden" name="enabled" value="true" />
                      <Button
                        type="submit"
                        variant={globalEnabled ? "secondary" : "primary"}
                        className="w-full"
                        disabled={globalEnabled}
                      >
                        Enable for all orgs
                      </Button>
                    </form>
                    <form action="/api/admin/feature-flags/global" method="post">
                      <input type="hidden" name="key" value={feature.key} />
                      <input type="hidden" name="enabled" value="false" />
                      <Button
                        type="submit"
                        variant="secondary"
                        className="w-full"
                        disabled={!globalEnabled}
                      >
                        Disable for all orgs
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
