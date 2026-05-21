import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePlatformRole } from "@/lib/auth/session";
import { listLocalizationDashboard } from "@/server/localization/localization-service";

export const dynamic = "force-dynamic";

export default async function AdminLocalizationPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const data = await listLocalizationDashboard(session);
  const rtlLocales = data.locales.filter((locale) => locale.textDirection === "rtl").length;
  const activeLocales = data.locales.filter((locale) => locale.status === "active").length;
  const activeCurrencies = data.currencies.filter((currency) => currency.status === "active").length;

  return (
    <AdminShell
      session={session}
      title="Localization"
      description="Manage language, currency, measurement, address, RTL, and country-specific regional defaults."
      actions={<Button asChild><Link href="/admin/localization/locales">Manage locales</Link></Button>}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Active locales" value={activeLocales} detail={`${rtlLocales} RTL locales`} />
        <Metric title="Currencies" value={activeCurrencies} detail={`${data.currencies.length} configured`} />
        <Metric title="Countries" value={data.countries.length} detail="Regional defaults" />
        <Metric title="Translations" value={data.translations.length} detail="Recent strings" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Regional controls</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["/admin/localization/locales", "Locales", "Enable languages, RTL, and formatting defaults."],
              ["/admin/localization/translations", "Translations", "Edit namespace-based UI strings by locale."],
              ["/admin/localization/countries", "Countries", "Set country locale, currency, address, and units."],
              ["/admin/localization/currencies", "Currencies", "Manage supported currencies and symbols."],
              ["/admin/localization/units", "Units & food terms", "Review unit systems and ingredient aliases."],
            ].map(([href, title, description]) => (
              <Link key={href} href={href} className="rounded-2xl border border-[var(--color-border)] bg-white p-4 transition hover:bg-slate-50">
                <p className="font-semibold text-[var(--text-primary)]">{title}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Country defaults</h2>
          <div className="mt-4 space-y-3">
            {data.countries.slice(0, 6).map((country) => (
              <div key={country.countryCode} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] p-3">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{country.countryName}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {country.regionalSetting?.defaultLocale ?? country.defaultLocale} · {country.currencyCode} · {country.regionalSetting?.measurementSystem ?? country.measurementSystem}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{country.countryCode}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

function Metric({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{detail}</p>
    </Card>
  );
}
