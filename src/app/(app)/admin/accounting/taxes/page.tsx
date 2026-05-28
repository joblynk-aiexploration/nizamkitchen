import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { TextArea } from "@/components/ui/text-area";
import { requirePlatformRole } from "@/lib/auth/session";
import { listTaxConfigurations } from "@/server/accounting/accounting-service";
import { AccountingTabs, Message, Money } from "../_accounting-ui";
import { saveTaxConfigurationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AccountingTaxesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const taxes = await listTaxConfigurations(session, { countryCode: params.countryCode });
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Tax configuration" description="Configure tax inputs by country, currency, and module. No jurisdiction-specific taxes are applied unless configured here.">
      <AccountingTabs />
      <Message message={params.message} />
      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add tax configuration</h2>
          <form action={saveTaxConfigurationAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <TextInput label="Name" name="name" placeholder="US food order tax placeholder" required />
            <TextInput label="Country code" name="countryCode" placeholder="US" maxLength={2} />
            <TextInput label="Region/state" name="region" placeholder="Optional" />
            <TextInput label="Currency" name="currencyCode" placeholder="USD" maxLength={3} />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">Module<select name="module" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"><option value="">Any module</option><option value="food_order">Food orders</option><option value="home_chef_request">Home chef requests</option><option value="subscription">Subscriptions</option></select></label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">Mode<select name="mode" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"><option value="disabled">Disabled</option><option value="flat_percent">Flat percent</option><option value="manual">Manual</option></select></label>
            <TextInput label="Tax percent" name="taxPercent" type="number" step="0.01" placeholder="0.00" />
            <TextInput label="Fixed tax amount" name="fixedTaxAmount" type="number" step="0.01" placeholder="0.00" />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">Status<select name="status" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="disabled">Disabled</option><option value="archived">Archived</option></select></label>
            <TextArea label="Notes" name="notes" className="md:col-span-3" />
            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-3">Save tax configuration</button>
          </form>
        </Card>
      ) : null}
      <AdminDataTable
        data={taxes}
        emptyMessage="No tax configurations yet."
        columns={[
          { key: "name", header: "Name", render: (tax) => <div><p className="font-semibold">{tax.name}</p><p className="text-sm text-[var(--text-secondary)]">{tax.countryCode ?? "Global"} · {tax.module ?? "all modules"}</p></div> },
          { key: "mode", header: "Mode", render: (tax) => tax.mode },
          { key: "percent", header: "Percent", render: (tax) => tax.taxPercent?.toString() ?? "Not set" },
          { key: "fixed", header: "Fixed", render: (tax) => tax.currencyCode ? <Money currencyCode={tax.currencyCode} amount={tax.fixedTaxAmount ?? 0} /> : "Not set" },
          { key: "status", header: "Status", render: (tax) => tax.status },
        ]}
      />
    </AdminShell>
  );
}
