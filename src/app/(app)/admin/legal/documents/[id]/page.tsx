import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { archiveLegalDocumentAction, publishLegalDocumentAction, updateDraftLegalDocumentAction } from "../../actions";
import { getLegalDocumentForAdmin } from "@/server/legal/legal-service";

export const dynamic = "force-dynamic";

export default async function LegalDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const { id } = await params;
  const document = await getLegalDocumentForAdmin(session, id);
  if (!document) notFound();

  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title={document.title}
      description="Review document metadata, immutable published content, and recent acceptances."
      actions={<Button asChild variant="secondary"><Link href="/admin/legal/documents">Back to documents</Link></Button>}
    >
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-muted)]">{document.slug} · version {document.version}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={document.status === "published" ? "success" : document.status === "archived" ? "neutral" : "warning"}>{document.status}</Badge>
              <Badge tone="neutral">{document.documentType}</Badge>
              <Badge tone="neutral">{document.audience}</Badge>
              <Badge tone="neutral">{document.countryCode ?? "global"}{document.region ? `/${document.region}` : ""}</Badge>
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {document.status === "draft" && (
                <form action={publishLegalDocumentAction}>
                  <input type="hidden" name="id" value={document.id} />
                  <Button type="submit">Publish version</Button>
                </form>
              )}
              {document.status !== "archived" && (
                <form action={archiveLegalDocumentAction}>
                  <input type="hidden" name="id" value={document.id} />
                  <Button type="submit" variant="secondary">Archive</Button>
                </form>
              )}
            </div>
          )}
        </div>
        <dl className="mt-6 grid gap-4 text-sm md:grid-cols-3">
          <div><dt className="text-[var(--color-muted)]">Created by</dt><dd className="font-medium">{document.createdBy.fullName ?? document.createdBy.email}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Published by</dt><dd className="font-medium">{document.publishedBy?.fullName ?? document.publishedBy?.email ?? "Not published"}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Published at</dt><dd className="font-medium">{document.publishedAt?.toLocaleString() ?? "Not published"}</dd></div>
        </dl>
      </Card>

      {document.status === "draft" && canManage ? (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Edit Draft</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Only drafts can be edited. Publish a new version instead of changing accepted text.</p>
          <form action={updateDraftLegalDocumentAction} className="mt-5 space-y-4">
            <input type="hidden" name="id" value={document.id} />
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Title
              <input name="title" defaultValue={document.title} required className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Markdown content
              <textarea name="contentMarkdown" defaultValue={document.contentMarkdown} required rows={16} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 font-mono text-sm" />
            </label>
            <Button type="submit">Save draft</Button>
          </form>
        </Card>
      ) : (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Published Text</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-[var(--color-ink)]">{document.contentMarkdown}</pre>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Recent Acceptances</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {document.acceptances.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No users have accepted this version yet.</p>
          ) : (
            document.acceptances.map((acceptance) => (
              <div key={acceptance.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{acceptance.user.fullName ?? acceptance.user.email}</p>
                  <p className="text-xs text-[var(--color-muted)]">{acceptance.organization?.name ?? "No organization"} · version {acceptance.acceptedVersion}</p>
                </div>
                <span className="text-xs text-[var(--color-muted)]">{acceptance.acceptedAt.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </AdminShell>
  );
}
