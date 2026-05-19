import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TextArea } from "@/components/ui/text-area";
import { requireMembership } from "@/lib/auth/session";
import { getUserSupportTicket } from "@/server/support";
import { addUserSupportTicketCommentAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SupportTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  const { id } = await params;
  const ticket = await getUserSupportTicket(session, id).catch(() => null);
  if (!ticket) notFound();

  const visibleComments = ticket.comments.filter((comment) => !comment.isInternal);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support ticket"
        title={ticket.title}
        description={`${ticket.type.replace(/_/g, " ")} · ${ticket.status.replace(/_/g, " ")}`}
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="info">{ticket.status}</Badge>
        <Badge tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"}>{ticket.priority}</Badge>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-muted)]">{ticket.description}</p>
        {ticket.pageUrl ? <p className="mt-4 text-sm text-[var(--color-muted)]">Page: {ticket.pageUrl}</p> : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Conversation</h2>
        <div className="mt-4 space-y-3">
          {visibleComments.map((comment) => (
            <div key={comment.id} className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{comment.author.fullName}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">{comment.body}</p>
            </div>
          ))}
          {visibleComments.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No replies yet.</p> : null}
        </div>
      </Card>

      <Card>
        <form action={addUserSupportTicketCommentAction.bind(null, ticket.id)} className="grid gap-4">
          <TextArea label="Reply" name="body" required />
          <div>
            <Button type="submit">Send reply</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
