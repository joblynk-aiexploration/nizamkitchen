import { PaymentEnvironment, PaymentGatewayStatus, PaymentProvider } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaymentGateway, paymentOperationalStatus } from "@/server/payments/admin";
import { savePaymentGatewayAction, savePaymentGatewayCredentialAction } from "../actions";

export const dynamic = "force-dynamic";

const providerOptions = Object.values(PaymentProvider).map((provider) => ({ value: provider, label: provider.replace(/_/g, " ") }));
const gatewayStatusOptions = Object.values(PaymentGatewayStatus).map((status) => ({ value: status, label: status.replace(/_/g, " ") }));
const environmentOptions = Object.values(PaymentEnvironment).map((environment) => ({ value: environment, label: environment }));

export default async function PaymentGatewayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [gateway, status] = await Promise.all([getPaymentGateway(session, id), paymentOperationalStatus()]);
  const canEditSecrets = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title={gateway.displayName} description="Gateway details, supported countries/currencies, and encrypted credential status.">
      {query.message && <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card>}
      <section className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Provider</p><p className="mt-3 text-xl font-semibold">{gateway.provider}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Environment</p><p className="mt-3 text-xl font-semibold">{gateway.environment}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Credentials</p><p className="mt-3 text-xl font-semibold">{gateway.credentials.length}</p></Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Gateway settings</h2>
        <form action={savePaymentGatewayAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={gateway.id} />
          <TextInput label="Display name" name="displayName" defaultValue={gateway.displayName} required />
          <SelectInput label="Provider" name="provider" defaultValue={gateway.provider} options={providerOptions} />
          <SelectInput label="Environment" name="environment" defaultValue={gateway.environment} options={environmentOptions} />
          <SelectInput label="Status" name="status" defaultValue={gateway.status} options={gatewayStatusOptions} />
          <TextInput label="Primary country code" name="countryCode" defaultValue={gateway.countryCode ?? ""} maxLength={2} />
          <TextInput label="Priority" name="priority" type="number" defaultValue={gateway.priority} />
          <TextArea label="Supported countries" name="supportedCountries" defaultValue={renderList(gateway.supportedCountriesJson)} />
          <TextArea label="Supported currencies" name="supportedCurrencies" defaultValue={renderList(gateway.supportedCurrenciesJson)} />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isDefault" defaultChecked={gateway.isDefault} className="h-4 w-4" /> Default gateway
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isPlatformGateway" defaultChecked={gateway.isPlatformGateway} className="h-4 w-4" /> Platform gateway
          </label>
          <div className="md:col-span-2"><Button type="submit">Save gateway</Button></div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Encrypted credentials</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Secrets are encrypted at rest. Full values are never shown after save.</p>
          </div>
          <Badge tone={status.encryptionConfigured ? "success" : "warning"}>{status.encryptionConfigured ? "Encryption ready" : "ENCRYPTION_KEY missing"}</Badge>
        </div>
        <div className="mt-4 grid gap-3">
          {gateway.credentials.length ? gateway.credentials.map((credential) => (
            <div key={credential.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <p className="font-semibold text-[var(--color-ink)]">{credential.keyName}</p>
              <p className="text-sm text-[var(--color-muted)]">{credential.valuePreview} · updated {credential.updatedAt.toLocaleDateString()}</p>
            </div>
          )) : <p className="text-sm text-[var(--color-muted)]">No credentials saved yet.</p>}
        </div>
        {canEditSecrets && (
          <form action={savePaymentGatewayCredentialAction} className="mt-6 grid gap-4 md:grid-cols-3">
            <input type="hidden" name="gatewayId" value={gateway.id} />
            <TextInput label="Key name" name="keyName" placeholder="secret_key" required />
            <TextInput label="Secret value" name="secretValue" type="password" required />
            <div className="flex items-end"><Button type="submit" className="w-full">Save encrypted secret</Button></div>
          </form>
        )}
      </Card>
    </AdminShell>
  );
}

function renderList(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}
