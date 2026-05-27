import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TextArea } from "@/components/ui/text-area";
import { requireUser } from "@/lib/auth/session";
import { formatAppDateTime } from "@/lib/utils";
import { getUserSupportTicket } from "@/server/support";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { initialsFromName } from "@/components/profiles/profile-components";
import { addUserSupportTicketCommentAction } from "../../actions";

export const dynamic = "force-dynamic";

type TicketComment = Awaited<ReturnType<typeof getUserSupportTicket>>["comments"][number];
type CommentAuthor = TicketComment["author"];

function authorOauthAvatar(author: Pick<CommentAuthor, "oauthAccounts">) {
  return author.oauthAccounts.map((account) => account.avatarUrl).find(Boolean) ?? null;
}

function priorityTone(priority: string) {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  return "neutral";
}

function statusTone(status: string) {
  if (status === "open") return "info";
  if (status === "resolved" || status === "closed") return "success";
  if (status === "waiting_on_user") return "warning";
  return "neutral";
}

function Avatar({
  src,
  name,
}: {
  src?: string | null;
  name: string;
}) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-sm font-semibold text-white ring-1 ring-slate-200">
      {src ? (
        // OAuth and storage avatar URLs are already resolved server-side.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} profile`} className="h-full w-full object-cover" />
      ) : (
        initialsFromName(name)
      )}
    </div>
  );
}

export default async function SupportTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  const ticket = await getUserSupportTicket(session, id).catch(() => null);
  if (!ticket) notFound();

  const visibleComments = ticket.comments.filter((comment) => !comment.isInternal);
  const authorAvatarEntries = await Promise.all(
    visibleComments.map(async (comment) => [
      comment.author.id,
      await getStorageImageUrl(session, comment.author.profilePhotoFileId, authorOauthAvatar(comment.author)),
    ] as const),
  );
  const authorAvatarById = new Map(authorAvatarEntries);
  const requesterAvatarUrl = ticket.createdBy
    ? await getStorageImageUrl(session, ticket.createdBy.profilePhotoFileId, authorOauthAvatar(ticket.createdBy))
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Support ticket"
        title={ticket.title}
        description="Track the issue, add replies, and keep the conversation with support in one place."
        actions={<Button asChild variant="secondary"><Link href="/support/tickets">Back to tickets</Link></Button>}
      />

      <Card className="overflow-hidden p-0">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.24),transparent_36%),linear-gradient(135deg,#071826,#0f2b3d_52%,#0f766e)] p-6 text-white md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar src={requesterAvatarUrl} name={ticket.createdBy?.fullName ?? "Support requester"} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Ticket from</p>
                <h2 className="mt-2 text-2xl font-semibold">{ticket.createdBy?.fullName ?? "NizamKitchen user"}</h2>
                <p className="mt-1 text-sm text-slate-200">{ticket.createdBy?.email ?? "Email unavailable"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(ticket.status)}>{ticket.status}</Badge>
              <Badge tone={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
              <Badge tone="neutral">{ticket.type.replace(/_/g, " ")}</Badge>
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Created</p>
              <p className="mt-1 font-semibold">{formatAppDateTime(ticket.createdAt, { showTimeZone: true })}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Updated</p>
              <p className="mt-1 font-semibold">{formatAppDateTime(ticket.updatedAt, { showTimeZone: true })}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Assigned</p>
              <p className="mt-1 font-semibold">{ticket.assignedTo?.fullName ?? "Support queue"}</p>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Issue details</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--color-muted)]">{ticket.description}</p>
            {ticket.pageUrl ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-[var(--color-muted)]">
                <span className="font-semibold text-[var(--color-ink)]">Page:</span> {ticket.pageUrl}
              </div>
            ) : null}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Reply</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Add anything new you discovered, screenshots notes, or steps to reproduce.</p>
            <form action={addUserSupportTicketCommentAction.bind(null, ticket.id)} className="mt-5 grid gap-4">
              <TextArea label="Message" name="body" required />
              <div>
                <Button type="submit">Send reply</Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-ink)]">Conversation</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{visibleComments.length} visible message(s)</p>
              </div>
              <Badge tone="info">Support thread</Badge>
            </div>
            <div className="mt-5 space-y-4">
              {visibleComments.map((comment) => {
                const isCurrentUser = comment.author.id === session.user.id;

                return (
                  <div key={comment.id} className={`flex gap-3 ${isCurrentUser ? "flex-row-reverse" : ""}`}>
                    <Avatar src={authorAvatarById.get(comment.author.id)} name={comment.author.fullName} />
                    <div className={`max-w-[min(100%,44rem)] rounded-3xl border border-[var(--color-border)] p-4 shadow-sm ${
                      isCurrentUser ? "bg-emerald-50" : "bg-white"
                    }`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--color-ink)]">{comment.author.fullName}</p>
                        {comment.author.platformRole ? <Badge tone="info">{comment.author.platformRole.replace(/_/g, " ")}</Badge> : null}
                        <span className="text-xs text-[var(--color-muted)]">{formatAppDateTime(comment.createdAt, { showTimeZone: true })}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--color-muted)]">{comment.body}</p>
                    </div>
                  </div>
                );
              })}
              {visibleComments.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-slate-50 p-6 text-sm text-[var(--color-muted)]">
                  No replies yet. Send the first message to start the conversation.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
