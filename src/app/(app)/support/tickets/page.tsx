import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireMembership } from "@/lib/auth/session";
import { listUserSupportTickets } from "@/server/support";

export const dynamic = "force-dynamic";

export default async function SupportTicketsPage() {
  const session = await requireMembership();
  const tickets = await listUserSupportTickets(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support tickets"
        title="My tickets"
        description="Track your beta feedback, bug reports, and support requests."
        actions={<Button asChild><Link href="/support/new">New ticket</Link></Button>}
      />

      <div className="grid gap-4">
        {tickets.map((ticket) => (
          <Card key={ticket.id} className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-[var(--color-ink)]">{ticket.title}</h2>
                <StatusBadge value={ticket.status} />
              </div>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{ticket.type.replace(/_/g, " ")} · {ticket.priority}</p>
            </div>
            <Button asChild variant="secondary">
              <Link href={`/support/tickets/${ticket.id}`}>Open</Link>
            </Button>
          </Card>
        ))}
        {tickets.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-muted)]">No support tickets yet.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
