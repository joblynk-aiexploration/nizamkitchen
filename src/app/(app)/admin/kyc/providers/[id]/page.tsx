import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listKycProviderConfigurations } from "@/server/kyc/kyc-service";

export const dynamic = "force-dynamic";

export default async function KycProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, routeParams] = await Promise.all([requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]), params]);
  const provider = (await listKycProviderConfigurations(session)).find((item) => item.id === routeParams.id);
  if (!provider) notFound();
  return (
    <AdminShell session={session} title={String(provider.displayName)} description="Provider details. Secrets are intentionally redacted.">
      <Card className="space-y-3 text-sm">
        <p><strong>Provider:</strong> {String(provider.provider).replace(/_/g, " ")}</p>
        <p><strong>Status:</strong> {String(provider.status)}</p>
        <p><strong>Environment:</strong> {String(provider.environment)}</p>
        <p><strong>API key:</strong> {String(provider.apiKeyPreview ?? "not configured")}</p>
        <p><strong>Secret configured:</strong> {provider.secretConfigured ? "yes" : "no"}</p>
        <p><strong>Webhook secret configured:</strong> {provider.webhookSecretConfigured ? "yes" : "no"}</p>
      </Card>
    </AdminShell>
  );
}
