import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listUnits } from "@/server/units";
import { listLocalizationDashboard } from "@/server/localization/localization-service";
import { saveFoodTerminologyAliasAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LocalizationUnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const [data, units] = await Promise.all([
    listLocalizationDashboard(session),
    listUnits({}),
  ]);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Units and food terminology" description="Review measurement systems and manage localized ingredient or food terminology aliases.">
      {params.message ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{params.message}</Card> : null}

      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add food terminology alias</h2>
          <form action={saveFoodTerminologyAliasAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Locale
              <select name="localeCode" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="">Any locale</option>
                {data.locales.map((locale) => <option key={locale.localeCode} value={locale.localeCode}>{locale.localeCode}</option>)}
              </select>
            </label>
            <TextInput label="Country code" name="countryCode" placeholder="IN" maxLength={2} />
            <TextInput label="Ingredient ID" name="ingredientId" placeholder="Optional linked ingredient ID" />
            <TextInput label="Source term" name="sourceTerm" placeholder="eggplant" required />
            <TextInput label="Localized term" name="localizedTerm" placeholder="baingan" required />
            <TextInput label="Transliteration" name="transliteration" placeholder="Optional" />
            <TextArea label="Notes" name="notes" className="md:col-span-3" />
            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-3">
              Save terminology alias
            </button>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminDataTable
          data={units}
          emptyMessage="No units configured yet."
          columns={[
            { key: "unit", header: "Unit", render: (unit) => <Link href={`/admin/units/${unit.id}`} className="font-semibold text-[var(--color-primary-strong)]">{unit.name}</Link> },
            { key: "code", header: "Code", render: (unit) => unit.code },
            { key: "type", header: "Type", render: (unit) => <Badge tone="info">{unit.type}</Badge> },
            { key: "system", header: "System", render: (unit) => <Badge tone="neutral">{unit.system}</Badge> },
          ]}
        />

        <AdminDataTable
          data={data.aliases}
          emptyMessage="No localized food terms configured yet."
          columns={[
            { key: "term", header: "Term", render: (alias) => <div><p className="font-semibold">{alias.sourceTerm}</p><p className="text-sm text-[var(--text-secondary)]">{alias.localizedTerm}</p></div> },
            { key: "locale", header: "Locale", render: (alias) => alias.localeCode ?? "Any" },
            { key: "country", header: "Country", render: (alias) => alias.countryCode ?? "Global" },
            { key: "ingredient", header: "Ingredient", render: (alias) => alias.ingredient?.name ?? "General" },
          ]}
        />
      </div>
    </AdminShell>
  );
}
