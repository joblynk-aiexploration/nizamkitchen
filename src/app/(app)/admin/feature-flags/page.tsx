import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listFeatureRegistry } from "@/server/admin/feature-flags";

export const dynamic = "force-dynamic";

const FEATURE_ICONS: Record<string, string> = {
  grocery_engine:              "🛒",
  meal_planner:                "📅",
  home_chefs:                  "👨‍🍳",
  home_catering:               "🍽️",
  restaurant_profiles:         "🏪",
  restaurant_fallback:         "🔄",
  menus:                       "📋",
  family_profiles:             "👨‍👩‍👧",
  grocery_partners:            "🤝",
  seller_verification:         "✅",
  youtube_references:          "▶️",
  cookie_privacy_consent:      "🔒",
};

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
      enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
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

  const enabledCount = features.filter((f) => f.globalFlag?.enabled).length;
  const totalCount = features.length;

  return (
    <AdminShell
      session={session}
      title="Feature flags"
      description="Control which features are active across your platform. Enable or disable globally, or manage per-account overrides."
    >
      {params.message ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <span className="text-base">✓</span>
          {params.message}
        </div>
      ) : null}

      {/* Summary bar */}
      <div className="flex flex-wrap gap-6 rounded-2xl border border-[var(--color-border)] bg-slate-50/70 px-6 py-4">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-[var(--color-ink)]">{enabledCount}</span>
          <span className="text-xs text-[var(--color-muted)]">features enabled globally</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-[var(--color-ink)]">{totalCount - enabledCount}</span>
          <span className="text-xs text-[var(--color-muted)]">features disabled</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-[var(--color-ink)]">{totalCount}</span>
          <span className="text-xs text-[var(--color-muted)]">total features</span>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid gap-4">
        {features.map((feature) => {
          const globalEnabled = feature.globalFlag?.enabled ?? false;
          const enabledOverrides = feature.orgOverrides.filter((o) => o.enabled).length;
          const disabledOverrides = feature.orgOverrides.filter((o) => !o.enabled).length;
          const inheritingCount = feature.totalOrgs - feature.orgOverrides.length;
          const icon = FEATURE_ICONS[feature.key] ?? "⚡";

          return (
            <Card
              key={feature.key}
              className={`transition-shadow hover:shadow-md ${globalEnabled ? "" : "opacity-80"}`}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                {/* Left: icon + info */}
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
                    globalEnabled ? "bg-emerald-50" : "bg-slate-100"
                  }`}>
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/feature-flags/${feature.key}`}
                        className="text-base font-bold text-[var(--color-ink)] hover:text-[var(--color-primary)] hover:underline underline-offset-2"
                      >
                        {feature.name}
                      </Link>
                      <StatusPill enabled={globalEnabled} />
                      {feature.scope === "global" && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                          platform-wide
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{feature.description}</p>
                    <code className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                      {feature.key}
                    </code>

                    {/* Org stats + overrides */}
                    {feature.scope === "org" && (
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <div className="flex gap-3 text-xs text-[var(--color-muted)]">
                          {enabledOverrides > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {enabledOverrides} override enabled
                            </span>
                          )}
                          {disabledOverrides > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              {disabledOverrides} override disabled
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            {inheritingCount} inheriting global
                          </span>
                        </div>
                        <Link
                          href={`/admin/feature-flags/${feature.key}`}
                          className="text-xs font-semibold text-[var(--color-primary)] hover:underline underline-offset-2"
                        >
                          Manage per-account →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: global controls */}
                {canMutate && (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                    <form action="/api/admin/feature-flags/global" method="post">
                      <input type="hidden" name="key" value={feature.key} />
                      <input type="hidden" name="enabled" value="true" />
                      <Button
                        type="submit"
                        variant={globalEnabled ? "secondary" : "primary"}
                        className="w-full"
                        disabled={globalEnabled}
                      >
                        Enable globally
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
                        Disable globally
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
