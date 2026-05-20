import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listUserPrivacyRequests } from "@/server/privacy/privacy-service";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const session = await requireMembership();
  const requests = await listUserPrivacyRequests(session);
  const latest = requests.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy"
        title="Data privacy controls"
        description="Request exports, corrections, or account deletion review. Deletion is reviewed before any data is anonymized or archived."
        actions={<Button asChild><Link href="/privacy/requests/new">New request</Link></Button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Exports</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Exports are generated as private JSON files and exclude secrets, raw payment payloads, and private KYC document contents.</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Deletion</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Deletion requests disable login and anonymize profile data after admin review. Payment, audit, and KYC records are preserved when required.</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Retention</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Retention rules may archive or retain data based on category, country, and legal/accounting needs.</p>
        </Card>
      </div>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Recent requests</h2>
          <Link href="/privacy/requests" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">View all</Link>
        </div>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {latest.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No privacy requests yet.</p> : latest.map((request) => (
            <Link key={request.id} href={`/privacy/requests/${request.id}`} className="block py-3 text-sm hover:text-[var(--color-primary)]">
              {request.requestType.replace(/_/g, " ")} · {request.status}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
