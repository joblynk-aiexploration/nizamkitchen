import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { getAdminSupportTicket } from "@/server/support";
import { addAdminSupportTicketCommentAction, updateAdminSupportTicketAction } from "../actions";

export const dynamic = "force-dynamic";

const supportRoles = ["platform_owner", "platform_admin", "support_admin"] as const;

export default async function AdminSupportTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole([...supportRoles]);
  const { id } = await params;
  const ticket = await getAdminSupportTicket(session, id).catch(() => null);
  if (!ticket) notFound();

  return (
    <AdminShell
      session={session}
      title={ticket.title}
      description={`${ticket.type.replace(/_/g, " ")} from ${ticket.createdBy?.email ?? "unknown user"}`}
    >
      <div className="flex flex-wrap gap-2">
        <Badge tone="info">{ticket.status}</Badge>
        <Badge tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"}>{ticket.priority}</Badge>
        {ticket.organization ? <Badge tone="neutral">{ticket.organization.name}</Badge> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">User report</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-muted)]">{ticket.description}</p>
            {ticket.pageUrl ? <p className="mt-4 text-sm text-[var(--color-muted)]">Page: {ticket.pageUrl}</p> : null}
            {ticket.browserInfo ? <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">Browser: {ticket.browserInfo}</p> : null}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Conversation</h2>
            <div className="mt-4 space-y-3">
              {ticket.comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">{comment.author.fullName}</p>
                    {comment.isInternal ? <Badge tone="warning">Internal</Badge> : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">{comment.body}</p>
                </div>
              ))}
              {ticket.comments.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No comments yet.</p> : null}
            </div>
          </Card>

          <Card>
            <form action={addAdminSupportTicketCommentAction.bind(null, ticket.id)} className="grid gap-4">
              <TextArea label="Reply" name="body" required />
              <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                <input type="checkbox" name="isInternal" />
                Internal note only
              </label>
              <div>
                <Button type="submit">Add reply</Button>
              </div>
            </form>
          </Card>
        </div>

        <Card>
          <form action={updateAdminSupportTicketAction.bind(null, ticket.id)} className="grid gap-4">
            <SelectInput
              label="Status"
              name="status"
              defaultValue={ticket.status}
              options={[
                { value: "open", label: "Open" },
                { value: "in_review", label: "In review" },
                { value: "waiting_on_user", label: "Waiting on user" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ]}
            />
            <SelectInput
              label="Priority"
              name="priority"
              defaultValue={ticket.priority}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
            />
            <TextInput label="Assigned admin user ID" name="assignedToId" defaultValue={ticket.assignedToId ?? ""} />
            <TextArea label="Admin notes" name="adminNotes" defaultValue={ticket.adminNotes ?? ""} />
            <Button type="submit">Save ticket</Button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
