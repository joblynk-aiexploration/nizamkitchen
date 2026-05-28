import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { listUserPrivacyRequests } from "@/server/privacy/privacy-service";

export const dynamic = "force-dynamic";

export default async function PrivacyRequestsPage() {
  const session = await requireMembership();
  const requests = await listUserPrivacyRequests(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy requests"
        title="My data requests"
        description="Track export, correction, deletion, and anonymization requests."
        actions={<Button asChild><Link href="/privacy/requests/new">New request</Link></Button>}
      />
      <div className="grid gap-4">
        {requests.length === 0 ? <Card><p className="text-sm text-[var(--color-muted)]">No privacy requests yet.</p></Card> : requests.map((request) => (
          <Card key={request.id} className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-[var(--color-ink)]">{request.requestType.replace(/_/g, " ")}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{request.createdAt.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge value={request.status} />
              <Button asChild variant="secondary"><Link href={`/privacy/requests/${request.id}`}>Open</Link></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
