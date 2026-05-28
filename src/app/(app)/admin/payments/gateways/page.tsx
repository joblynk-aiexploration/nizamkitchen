import { PaymentGatewayStatus, PaymentProvider } from "@prisma/client";
import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPaymentGateways } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

export default async function PaymentGatewaysPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const gateways = await listPaymentGateways(session);

  return (
    <AdminShell session={session} title="Payment gateways" description="Create hosted-checkout gateway records and store provider credentials encrypted. Future SDK adapters plug into this registry.">
      {params.message && <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card>}
      <div className="flex justify-end">
        <Button asChild><Link href="/admin/payments/gateways/new">Create gateway</Link></Button>
      </div>
      <AdminDataTable
        data={gateways}
        emptyMessage="No payment gateways configured yet."
        columns={[
          {
            key: "gateway",
            header: "Gateway",
            render: (gateway) => (
              <div>
                <Link href={`/admin/payments/gateways/${gateway.id}`} className="font-semibold text-[var(--color-primary)]">{gateway.displayName}</Link>
                <p className="text-[var(--color-muted)]">{gateway.provider} · {gateway.environment}</p>
              </div>
            ),
          },
          { key: "status", header: "Status", render: (gateway) => <GatewayStatusBadge status={gateway.status} /> },
          { key: "scope", header: "Scope", render: (gateway) => gateway.countryCode ?? "Global/platform" },
          { key: "countries", header: "Countries", render: (gateway) => renderJsonList(gateway.supportedCountriesJson) },
          { key: "currencies", header: "Currencies", render: (gateway) => renderJsonList(gateway.supportedCurrenciesJson) },
          { key: "credentials", header: "Credentials", render: (gateway) => `${gateway.credentials.length} configured` },
        ]}
      />
    </AdminShell>
  );
}

export function GatewayStatusBadge({ status }: { status: PaymentGatewayStatus }) {
  const tone = status === "active" ? "success" : status === "disabled" ? "neutral" : status === "error" ? "danger" : "warning";
  return <Badge tone={tone}>{status}</Badge>;
}

export const providerOptions = Object.values(PaymentProvider).map((provider) => ({ value: provider, label: provider.replace(/_/g, " ") }));

export const gatewayStatusOptions = Object.values(PaymentGatewayStatus).map((status) => ({ value: status, label: status.replace(/_/g, " ") }));

function renderJsonList(value: unknown) {
  return Array.isArray(value) && value.length ? value.join(", ") : "Any configured";
}
