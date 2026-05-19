import Link from "next/link";
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

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Profile</p>
          <p className="mt-2 text-lg font-semibold">Personal profile and photos</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Upload your S3-backed profile and cover photos without exposing storage credentials.
          </p>
        </div>
        <Link
          href="/settings/profile"
          className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
        >
          Open profile settings
        </Link>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Meal planner</p>
          <p className="mt-2 text-lg font-semibold">Household planning preferences</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Save your default household size, spice profile, and cooking rhythm for new meal plans.
          </p>
        </div>
        <Link
          href="/settings/meal-preferences"
          className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
        >
          Open meal preferences
        </Link>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notifications</p>
          <p className="mt-2 text-lg font-semibold">In-app and email preferences</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Control operational updates for chef requests, grocery lists, meal planning, and admin alerts.
          </p>
        </div>
        <Link
          href="/settings/notifications"
          className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
        >
          Open notification settings
        </Link>
      </Card>
    </div>
  );
}
