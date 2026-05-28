import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { paymentOperationalStatus } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const status = paymentOperationalStatus();

  return (
    <AdminShell session={session} title="Payment safety settings" description="Operational guardrails for hosted checkout and future provider SDK integrations.">
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Credential encryption</h2>
            <Badge tone={status.encryptionConfigured ? "success" : "warning"}>{status.encryptionConfigured ? "configured" : "missing"}</Badge>
          </div>
          <p className="mt-3 text-sm text-[var(--color-muted)]">ENCRYPTION_KEY is required before gateway secret keys can be saved. Only encrypted values and masked previews are stored.</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Card data policy</h2>
            <Badge tone="success">hosted only</Badge>
          </div>
          <p className="mt-3 text-sm text-[var(--color-muted)]">NizamKitchen must use hosted checkout, payment elements, or wallet/provider redirects. Raw card numbers and CVV fields are not allowed.</p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Registered providers</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">{status.registeredProviders.join(", ")}</p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Emergency disable</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Use feature flags to disable payments, live checkout, provider-specific gateways, refunds, disputes, or payouts without disabling unpaid order requests.</p>
        </Card>
      </section>
    </AdminShell>
  );
}
