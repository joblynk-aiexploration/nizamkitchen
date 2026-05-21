import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TextInput } from "@/components/ui/text-input";
import { getUserLocalizationPreferences } from "@/server/localization/localization-service";
import { saveUserPreferencesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UserPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const { preference, locales, currencies } = await getUserLocalizationPreferences(session);
  const org = session.activeOrganization;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Preferences"
        title="Language and regional settings"
        description="Choose your language, timezone, currency, measurement, and date/time display preferences."
      />

      {params.message ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{params.message}</Card> : null}

      <Card>
        <form action={saveUserPreferencesAction} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Language / locale
            <select
              name="localeCode"
              defaultValue={preference?.localeCode ?? session.user.preferredLocale ?? org.defaultLocale}
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
            >
              {locales.length ? locales.map((locale) => (
                <option key={locale.localeCode} value={locale.localeCode}>
                  {locale.languageName} ({locale.localeCode})
                </option>
              )) : <option value={org.defaultLocale}>{org.defaultLocale}</option>}
            </select>
          </label>

          <TextInput
            label="Timezone"
            name="timezone"
            defaultValue={preference?.timezone ?? session.user.preferredTimezone ?? org.defaultTimezone}
            placeholder="America/Chicago"
            required
          />

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Measurement system
            <select
              name="measurementSystem"
              defaultValue={preference?.measurementSystem ?? org.measurementSystem}
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
            >
              <option value="">Use organization default</option>
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Currency
            <select
              name="currencyCode"
              defaultValue={preference?.currencyCode ?? org.currencyCode}
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
            >
              <option value="">Use organization default</option>
              {currencies.length ? currencies.map((currency) => (
                <option key={currency.currencyCode} value={currency.currencyCode}>
                  {currency.currencyCode} · {currency.displayName}
                </option>
              )) : <option value={org.currencyCode}>{org.currencyCode}</option>}
            </select>
          </label>

          <TextInput label="Date format" name="dateFormat" defaultValue={preference?.dateFormat ?? ""} placeholder="MM/dd/yyyy" />
          <TextInput label="Time format" name="timeFormat" defaultValue={preference?.timeFormat ?? ""} placeholder="h:mm a" />

          <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-2">
            Save preferences
          </button>
        </form>
      </Card>
    </div>
  );
}
