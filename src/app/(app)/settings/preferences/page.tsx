import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { DATE_FORMAT_OPTIONS, DEFAULT_TIME_FORMAT, TIME_FORMAT_OPTIONS, normalizeDateFormat } from "@/lib/date-time-formats";
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
  const { preference, locales, currencies, timeZones } = await getUserLocalizationPreferences(session);
  const org = session.activeOrganization;
  const selectedDateFormat = normalizeDateFormat(preference?.dateFormat);
  const selectedTimeFormat = preference?.timeFormat === DEFAULT_TIME_FORMAT ? preference.timeFormat : DEFAULT_TIME_FORMAT;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Preferences"
        title="Language and regional settings"
        description="Choose your language, timezone, currency, measurement, and date/time display preferences."
      />

      <FormMessage message={params.message} />

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

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Timezone
            <select
              name="timezone"
              defaultValue={preference?.timezone ?? session.user.preferredTimezone ?? org.defaultTimezone}
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              required
            >
              {timeZones.length ? timeZones.map((timeZone) => (
                <option key={timeZone.value} value={timeZone.value}>
                  {timeZone.label}
                </option>
              )) : <option value={org.defaultTimezone}>{org.defaultTimezone}</option>}
            </select>
            <span className="text-xs font-normal text-[var(--color-muted)]">
              Options are limited to timezones for countries enabled by the Platform Owner.
            </span>
          </label>

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
            <span className="text-xs font-normal text-[var(--color-muted)]">
              Options are limited to currencies attached to countries enabled by the Platform Owner.
            </span>
          </label>

          <SelectInput
            label="Date format"
            name="dateFormat"
            defaultValue={selectedDateFormat}
            options={[...DATE_FORMAT_OPTIONS]}
            hint="Default is MM/DD/YYYY."
          />
          <SelectInput
            label="Time format"
            name="timeFormat"
            defaultValue={selectedTimeFormat}
            options={[...TIME_FORMAT_OPTIONS]}
            hint="NizamKitchen uses 12-hour time across the app."
          />

          <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-2">
            Save preferences
          </button>
        </form>
      </Card>
    </div>
  );
}
