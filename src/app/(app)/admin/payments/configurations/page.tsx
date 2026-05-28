import { PaymentConfigurationStatus } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listPaymentConfigurations, listPaymentGateways } from "@/server/payments/admin";
import { savePaymentConfigurationAction } from "./actions";

export const dynamic = "force-dynamic";

const statusOptions = Object.values(PaymentConfigurationStatus).map((status) => ({ value: status, label: status }));

export default async function PaymentConfigurationsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const [configurations, gateways, countries] = await Promise.all([
    listPaymentConfigurations(session),
    listPaymentGateways(session),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { countryName: "asc" } }),
  ]);

  return (
    <AdminShell session={session} title="Payment configurations" description="Control default gateways, payment method availability, tax, and commission by country and currency.">
      {params.message && <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card>}
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Create or update configuration</h2>
        <form action={savePaymentConfigurationAction} className="mt-4 grid gap-4 md:grid-cols-3">
          <SelectInput label="Country" name="countryCode" options={countries.map((country) => ({ value: country.countryCode, label: `${country.countryName} (${country.countryCode})` }))} />
          <TextInput label="Currency" name="currencyCode" defaultValue="USD" maxLength={3} />
          <SelectInput label="Default gateway" name="defaultGatewayId" options={[{ value: "", label: "No default" }, ...gateways.map((gateway) => ({ value: gateway.id, label: gateway.displayName }))]} />
          <TextInput label="Platform commission %" name="platformCommissionPercent" type="number" step="0.01" placeholder="10" />
          <TextInput label="Fixed commission" name="fixedCommissionAmount" type="number" step="0.01" placeholder="0.50" />
          <TextInput label="Tax %" name="taxPercent" type="number" step="0.01" placeholder="0" />
          <SelectInput label="Status" name="status" options={statusOptions} />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]"><input type="checkbox" name="allowStripe" className="h-4 w-4" /> Stripe</label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]"><input type="checkbox" name="allowPayPal" className="h-4 w-4" /> PayPal</label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]"><input type="checkbox" name="allowGooglePay" className="h-4 w-4" /> Google Pay</label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]"><input type="checkbox" name="allowManualPayment" defaultChecked className="h-4 w-4" /> Manual/offline payment</label>
          <div className="md:col-span-3"><Button type="submit">Save configuration</Button></div>
        </form>
      </Card>

      <AdminDataTable
        data={configurations}
        emptyMessage="No payment configurations found."
        columns={[
          { key: "country", header: "Country", render: (configuration) => configuration.countryCode },
          { key: "currency", header: "Currency", render: (configuration) => configuration.currencyCode },
          { key: "status", header: "Status", render: (configuration) => <Badge tone={configuration.status === "active" ? "success" : "neutral"}>{configuration.status}</Badge> },
          { key: "methods", header: "Methods", render: (configuration) => enabledMethods(configuration).join(", ") || "None" },
          { key: "commission", header: "Commission", render: (configuration) => `${configuration.platformCommissionPercent ?? "0"}% + ${configuration.fixedCommissionAmount ?? "0"}` },
        ]}
      />
    </AdminShell>
  );
}

function enabledMethods(configuration: { allowStripe: boolean; allowPayPal: boolean; allowGooglePay: boolean; allowManualPayment: boolean }) {
  return [
    configuration.allowStripe ? "Stripe" : null,
    configuration.allowPayPal ? "PayPal" : null,
    configuration.allowGooglePay ? "Google Pay" : null,
    configuration.allowManualPayment ? "Manual" : null,
  ].filter(Boolean) as string[];
}
