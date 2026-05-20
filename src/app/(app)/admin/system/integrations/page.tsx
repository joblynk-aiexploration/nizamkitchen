import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getIntegrationStatuses } from "@/server/admin/system-status";

export const dynamic = "force-dynamic";

export default async function AdminSystemIntegrationsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const integrations = await getIntegrationStatuses();
  const rows = [
    { name: "MapTiler", configured: integrations.mapTiler.configured, detail: integrations.mapTiler.enabled ? "Discovery enabled" : "Discovery disabled" },
    { name: "YouTube", configured: integrations.youtube.configured, detail: integrations.youtube.enabled ? "Discovery enabled" : "Discovery disabled" },
    { name: "SMTP", configured: integrations.smtp.configured, detail: "Transactional email delivery" },
    { name: "Stripe", configured: integrations.stripe.configured, detail: `${integrations.stripe.activeGateways} active gateways` },
    { name: "PayPal", configured: integrations.paypal.configured, detail: `${integrations.paypal.activeGateways} active gateways` },
    { name: "S3 storage", configured: integrations.storage.configured, detail: `${integrations.storage.failingConfigurations} failing configs` },
    { name: "KYC providers", configured: integrations.kyc.configured, detail: `${integrations.kyc.activeProviders} active providers` },
    { name: "Error tracking", configured: integrations.errorTracking.configured, detail: integrations.errorTracking.enabled ? "Enabled" : "Disabled" },
  ];

  return (
    <AdminShell
      session={session}
      title="Integration status"
      description="Configuration readiness for optional providers. Secret values are intentionally omitted."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <Card key={row.name}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--color-ink)]">{row.name}</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{row.detail}</p>
              </div>
              <Badge tone={row.configured ? "success" : "warning"}>{row.configured ? "Configured" : "Not configured"}</Badge>
            </div>
          </Card>
        ))}
      </section>
    </AdminShell>
  );
}
