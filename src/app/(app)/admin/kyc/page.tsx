import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { kycOperationalStatus, listIdentityVerifications, listKycProviderConfigurations, listKycWebhookEvents } from "@/server/kyc/kyc-service";

export const dynamic = "force-dynamic";

export default async function AdminKycPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [providers, identities, webhooks] = await Promise.all([
    listKycProviderConfigurations(session),
    listIdentityVerifications(session),
    listKycWebhookEvents(session),
  ]);
  const status = kycOperationalStatus();
  return (
    <AdminShell session={session} title="KYC and background checks" description="Provider-ready identity verification and background-check operations without storing raw identity data.">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Providers" value={providers.length} />
        <Metric label="Identity sessions" value={identities.length} />
        <Metric label="Webhook events" value={webhooks.length} />
        <Metric label="Raw reports stored" value={status.rawBackgroundReportsStored ? "Yes" : "No"} />
      </section>
      <Card className="flex flex-wrap gap-3">
        <Button asChild><Link href="/admin/kyc/providers">Manage providers</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/kyc/identity-verifications">Identity verifications</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/kyc/background-checks">Background checks</Link></Button>
      </Card>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p></Card>;
}
