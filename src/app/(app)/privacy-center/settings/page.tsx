import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ManageCookiePreferencesButton } from "@/components/privacy/manage-cookie-preferences-button";
import { getOrCreateUserPrivacySetting } from "@/server/privacy/privacy-service";
import { savePrivacySettingsAction } from "../../privacy/actions";

export const dynamic = "force-dynamic";

export default async function PrivacyCenterSettingsPage() {
  const session = await requireMembership();
  const settings = await getOrCreateUserPrivacySetting(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy center"
        title="Privacy settings"
        description="Control profile visibility, communications, cookie preferences, analytics consent, activity retention preference, and personalization."
        actions={<Button asChild variant="secondary"><Link href="/privacy-center">Back</Link></Button>}
      />
      <Card>
        <form action={savePrivacySettingsAction} className="space-y-5">
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Profile visibility
            <select name="profileVisibility" defaultValue={settings.profileVisibility} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
              <option value="private">Private</option>
              <option value="organization">Organization only</option>
              <option value="public">Public</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Activity retention preference in days
            <input
              name="activityRetentionDays"
              type="number"
              min="1"
              max="3650"
              defaultValue={settings.activityRetentionDays ?? ""}
              placeholder="Optional"
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3">
            <Checkbox name="marketingEmailsEnabled" label="Allow marketing emails" defaultChecked={settings.marketingEmailsEnabled} />
            <Checkbox name="analyticsConsent" label="Allow analytics cookies and measurement" defaultChecked={settings.analyticsConsent} />
            <Checkbox name="marketingCookiesConsent" label="Allow marketing and advertising cookies" defaultChecked={settings.marketingCookiesConsent} />
            <Checkbox name="functionalCookiesConsent" label="Allow functional preference cookies" defaultChecked={settings.functionalCookiesConsent} />
            <Checkbox name="personalizedRecommendationsEnabled" label="Allow personalized recommendations" defaultChecked={settings.personalizedRecommendationsEnabled} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Save privacy settings</Button>
            <ManageCookiePreferencesButton className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-emerald-50" />
          </div>
        </form>
      </Card>
    </div>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-ink)]">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}
