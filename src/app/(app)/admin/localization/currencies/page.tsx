import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listLocalizationDashboard } from "@/server/localization/localization-service";
import { saveCurrencyAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LocalizationCurrenciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const data = await listLocalizationDashboard(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Currencies" description="Control supported currencies, symbols, decimal handling, and country availability.">
      {params.message ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{params.message}</Card> : null}

      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add or update currency</h2>
          <form action={saveCurrencyAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <TextInput label="Currency code" name="currencyCode" placeholder="USD" maxLength={3} required />
            <TextInput label="Display name" name="displayName" placeholder="US Dollar" required />
            <TextInput label="Symbol" name="symbol" placeholder="$" required />
            <TextInput label="Decimal digits" name="decimalDigits" type="number" defaultValue="2" required />
            <TextInput label="Country codes" name="countryCodes" placeholder="US, CA" hint="Comma-separated country codes." />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Status
              <select name="status" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-3">
              Save currency
            </button>
          </form>
        </Card>
      ) : null}

      <AdminDataTable
        data={data.currencies}
        emptyMessage="No currencies configured yet."
        columns={[
          { key: "currency", header: "Currency", render: (currency) => <div><p className="font-semibold">{currency.currencyCode}</p><p className="text-sm text-[var(--text-secondary)]">{currency.displayName}</p></div> },
          { key: "symbol", header: "Symbol", render: (currency) => <span className="text-lg font-semibold">{currency.symbol}</span> },
          { key: "digits", header: "Decimals", render: (currency) => currency.decimalDigits },
          { key: "countries", header: "Countries", render: (currency) => Array.isArray(currency.countryCodesJson) ? currency.countryCodesJson.join(", ") : "Global" },
          { key: "status", header: "Status", render: (currency) => <Badge tone={currency.status === "active" ? "success" : "neutral"}>{currency.status}</Badge> },
        ]}
      />
    </AdminShell>
  );
}
