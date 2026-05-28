import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT, TIME_FORMAT_OPTIONS } from "@/lib/date-time-formats";
import { listLocalizationDashboard } from "@/server/localization/localization-service";
import { saveCountryRegionalSettingAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LocalizationCountriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const data = await listLocalizationDashboard(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Country regional settings" description="Set default locale, currencies, units, address format, and RTL behavior per country.">
      {params.message ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{params.message}</Card> : null}

      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Update country regional defaults</h2>
          <form action={saveCountryRegionalSettingAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Country
              <select name="countryCode" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                {data.countries.map((country) => <option key={country.countryCode} value={country.countryCode}>{country.countryName} ({country.countryCode})</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Default locale
              <select name="defaultLocale" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                {data.locales.map((locale) => <option key={locale.localeCode} value={locale.localeCode}>{locale.localeCode}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Measurement system
              <select name="measurementSystem" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="metric">Metric</option>
                <option value="imperial">Imperial</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <TextInput label="Supported locales" name="supportedLocales" placeholder="en-US, ar-SA" hint="Comma-separated locale codes." />
            <TextInput label="Supported currencies" name="supportedCurrencyCodes" placeholder="USD, SAR" hint="Comma-separated currency codes." />
            <SelectInput label="Date format" name="dateFormat" defaultValue={DEFAULT_DATE_FORMAT} options={[...DATE_FORMAT_OPTIONS]} required />
            <SelectInput label="Time format" name="timeFormat" defaultValue={DEFAULT_TIME_FORMAT} options={[...TIME_FORMAT_OPTIONS]} required />
            <TextArea label="Address format" name="addressFormat" placeholder="name, street, city, region, postalCode, country" className="md:col-span-2" hint="Comma-separated address fields in display order." />
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
              <input type="checkbox" name="rtlEnabled" />
              RTL enabled for this country
            </label>
            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-3">
              Save country settings
            </button>
          </form>
        </Card>
      ) : null}

      <AdminDataTable
        data={data.countries}
        emptyMessage="No country records available."
        columns={[
          { key: "country", header: "Country", render: (country) => <div><p className="font-semibold">{country.countryName}</p><p className="text-sm text-[var(--text-secondary)]">{country.countryCode}</p></div> },
          { key: "locale", header: "Locale", render: (country) => country.regionalSetting?.defaultLocale ?? country.defaultLocale },
          { key: "currency", header: "Currencies", render: (country) => Array.isArray(country.regionalSetting?.supportedCurrencyCodesJson) ? country.regionalSetting.supportedCurrencyCodesJson.join(", ") : country.currencyCode },
          { key: "measurement", header: "Measurement", render: (country) => country.regionalSetting?.measurementSystem ?? country.measurementSystem },
          { key: "address", header: "Address format", render: (country) => Array.isArray(country.regionalSetting?.addressFormatJson) ? country.regionalSetting.addressFormatJson.join(" → ") : "Default" },
        ]}
      />
    </AdminShell>
  );
}
