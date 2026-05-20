import { KycProvider, KycProviderStatus, PaymentEnvironment } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { saveKycProviderConfigurationAction } from "../../../seller-verification-actions";
import { kycOperationalStatus, listKycProviderConfigurations } from "@/server/kyc/kyc-service";

export const dynamic = "force-dynamic";

export default async function KycProvidersPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [session, params] = await Promise.all([requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]), searchParams]);
  const providers = await listKycProviderConfigurations(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";
  const status = kycOperationalStatus();
  return (
    <AdminShell session={session} title="KYC providers" description="Configure identity/KYC/background-check providers. Secrets are encrypted and never shown after save.">
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <Card className="text-sm text-[var(--color-muted)]">Encryption configured: <strong>{status.encryptionConfigured ? "yes" : "no"}</strong>. Raw identity data and full background reports are not stored.</Card>
      {canManage ? (
        <Card className="space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Add provider</h2>
          <form action={saveKycProviderConfigurationAction} className="grid gap-4 md:grid-cols-3">
            <SelectInput label="Provider" name="provider" options={Object.values(KycProvider).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
            <TextInput label="Display name" name="displayName" />
            <SelectInput label="Status" name="status" options={Object.values(KycProviderStatus).map((value) => ({ value, label: value }))} />
            <SelectInput label="Environment" name="environment" options={Object.values(PaymentEnvironment).map((value) => ({ value, label: value }))} />
            <TextInput label="Country override" name="countryCode" maxLength={2} />
            <TextInput label="Supported countries" name="supportedCountries" placeholder="US,CA,AE" />
            <TextInput label="API key" name="apiKey" type="password" />
            <TextInput label="Secret" name="secret" type="password" />
            <TextInput label="Webhook secret" name="webhookSecret" type="password" />
            <TextArea label="Settings JSON" name="settingsJson" />
            <div className="flex items-end"><Button type="submit">Save provider</Button></div>
          </form>
        </Card>
      ) : null}
      <AdminDataTable
        data={providers}
        emptyMessage="No KYC providers configured."
        columns={[
          { key: "provider", header: "Provider", render: (item) => String(item.provider).replace(/_/g, " ") },
          { key: "display", header: "Display name", render: (item) => String(item.displayName) },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "active" ? "success" : item.status === "error" ? "danger" : "neutral"}>{String(item.status)}</Badge> },
          { key: "country", header: "Country", render: (item) => String(item.countryCode ?? "global") },
          { key: "api", header: "API key", render: (item) => String(item.apiKeyPreview ?? "not configured") },
          { key: "secret", header: "Secret", render: (item) => item.secretConfigured ? "configured" : "not configured" },
          { key: "webhook", header: "Webhook secret", render: (item) => item.webhookSecretConfigured ? "configured" : "not configured" },
        ]}
      />
    </AdminShell>
  );
}
