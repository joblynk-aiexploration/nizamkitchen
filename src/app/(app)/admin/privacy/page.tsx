import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listAdminPrivacyRequests, listRetentionPolicies } from "@/server/privacy/privacy-service";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const [requests, policies] = await Promise.all([
    listAdminPrivacyRequests(session),
    listRetentionPolicies(session),
  ]);
  const openRequests = requests.filter((request) => ["submitted", "reviewing", "processing"].includes(request.status)).length;

  return (
    <AdminShell
      session={session}
      title="Privacy Center"
      description="Manage data export, correction, deletion, anonymization, and retention controls."
      actions={<Button asChild><Link href="/admin/privacy/requests">View requests</Link></Button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Requests</p><p className="mt-2 text-4xl font-bold">{requests.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Open</p><p className="mt-2 text-4xl font-bold">{openRequests}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Retention policies</p><p className="mt-2 text-4xl font-bold">{policies.length}</p></Card>
      </div>
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Preservation warnings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Payments and audit logs may need to be retained for legal/accounting reasons.</p>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">KYC/background-check records may be subject to provider/legal retention requirements.</p>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Do not delete data required for active disputes, orders, refunds, or investigations.</p>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Button asChild variant="secondary"><Link href="/admin/privacy/requests">Manage privacy requests</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/privacy/retention">Manage retention policies</Link></Button>
      </div>
    </AdminShell>
  );
}
