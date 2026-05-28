import { notFound } from "next/navigation";
import { EmailTemplateStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { getEmailTemplateForAdmin, previewEmailTemplate } from "@/server/email/email-template-service";
import { activateEmailTemplateAction, archiveEmailTemplateAction, updateEmailTemplateAction } from "../../actions";
import { EmailCenterTabs, EmailStatusBadge } from "../../_components";

export const dynamic = "force-dynamic";

const statusOptions = Object.values(EmailTemplateStatus).map((status) => ({ value: status, label: status }));

export default async function EmailTemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const template = await getEmailTemplateForAdmin(session, id);
  if (!template) notFound();
  const preview = await previewEmailTemplate(session, id);
  const canEdit = session.user.platformRole === "platform_owner" || (!template.isSystem && session.user.platformRole === "platform_admin");
  const isLocked = template.status === EmailTemplateStatus.active;

  return (
    <AdminShell
      session={session}
      title={template.name}
      description={`${template.templateKey} · v${template.version}. Active templates are protected from silent edits; create a new version for production changes.`}
    >
      <EmailCenterTabs active="/admin/emails/templates" />
      <FormMessage message={query.message} />
      <div className="flex flex-wrap gap-2">
        <EmailStatusBadge status={template.status} />
        <Badge tone={template.isSystem ? "info" : "neutral"}>{template.isSystem ? "System template" : "Custom template"}</Badge>
        <Badge tone="neutral">{template.category}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <form action={updateEmailTemplateAction} className="grid gap-5">
            <input type="hidden" name="id" value={template.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Name" name="name" defaultValue={template.name} disabled={!canEdit || isLocked} required />
              <SelectInput label="Status" name="status" options={statusOptions} defaultValue={template.status} disabled={!canEdit || isLocked} />
            </div>
            <TextArea label="Description" name="description" defaultValue={template.description ?? ""} disabled={!canEdit || isLocked} />
            <TextInput label="Subject" name="subject" defaultValue={template.subject} disabled={!canEdit || isLocked} required />
            <TextInput label="Preheader" name="preheader" defaultValue={template.preheader ?? ""} disabled={!canEdit || isLocked} />
            <TextArea label="HTML body" name="htmlBody" defaultValue={template.htmlBody} disabled={!canEdit || isLocked} required />
            <TextArea label="Plain-text body" name="textBody" defaultValue={template.textBody} disabled={!canEdit || isLocked} required />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={!canEdit || isLocked}>Save draft</Button>
            </div>
          </form>
          {isLocked ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This template is active. To avoid accidental production changes, active templates are not silently editable.
            </p>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={activateEmailTemplateAction}>
                <input type="hidden" name="id" value={template.id} />
                <Button type="submit" variant="success" disabled={!canEdit || template.status === "active"}>Activate</Button>
              </form>
              <form action={archiveEmailTemplateAction}>
                <input type="hidden" name="id" value={template.id} />
                <Button type="submit" variant="danger" disabled={!canEdit || template.status === "archived"}>Archive</Button>
              </form>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Variables</h2>
            <div className="mt-4 space-y-2">
              {template.variables.length ? template.variables.map((variable) => (
                <div key={variable.id} className="rounded-2xl border border-[var(--color-border)] p-3">
                  <p className="font-mono text-sm font-semibold text-[var(--color-ink)]">{`{{${variable.variableKey}}}`}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{variable.description ?? "No description."}</p>
                </div>
              )) : <p className="text-sm text-[var(--color-muted)]">No variables documented yet.</p>}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Preview</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Subject: {preview.subject}</p>
        <iframe title="Email preview" className="mt-4 h-[520px] w-full rounded-2xl border border-[var(--color-border)] bg-white" srcDoc={preview.html} />
      </Card>
    </AdminShell>
  );
}
