import Link from "next/link";
import { EmailDeliveryStatus, EmailTemplateStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listEmailLogs, listEmailTemplates } from "@/server/email/email-template-service";
import { EmailCenterTabs, EmailStatusBadge } from "./_components";

export const dynamic = "force-dynamic";

export default async function AdminEmailCenterPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const [templates, logs, suppressionCount] = await Promise.all([
    listEmailTemplates(session),
    listEmailLogs(session, 8),
    prisma.emailSuppression.count(),
  ]);
  const activeTemplates = templates.filter((template) => template.status === EmailTemplateStatus.active).length;
  const failedLogs = logs.filter((log) => log.status === EmailDeliveryStatus.failed).length;

  return (
    <AdminShell
      session={session}
      title="Email Center"
      description="Manage enterprise email templates, preferences, suppressions, test sends, and delivery logs without exposing SMTP secrets."
      actions={<Button asChild><Link href="/admin/emails/templates/new">New template</Link></Button>}
    >
      <EmailCenterTabs active="/admin/emails" />
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Templates</p><p className="mt-3 text-3xl font-semibold">{templates.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active</p><p className="mt-3 text-3xl font-semibold">{activeTemplates}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent failures</p><p className="mt-3 text-3xl font-semibold">{failedLogs}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Suppressions</p><p className="mt-3 text-3xl font-semibold">{suppressionCount}</p></Card>
      </section>
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Delivery posture</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Email delivery uses the Platform Configuration Vault SMTP providers. If SMTP is missing or disabled, sends are logged as skipped instead of crashing user workflows.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="secondary"><Link href="/admin/apis?message=Open or create SMTP email provider APIs under API Management.">Configure SMTP</Link></Button>
          <Button asChild variant="secondary"><Link href="/admin/emails/test-send">Send test email</Link></Button>
          <Button asChild variant="secondary"><Link href="/settings/notifications">Notification preferences</Link></Button>
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Recent email activity</h2>
        <div className="mt-4 space-y-3">
          {logs.length ? logs.map((log) => (
            <div key={log.id} className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{log.subject}</p>
                <p className="text-sm text-[var(--color-muted)]">{log.recipientEmail} · {log.templateKey ?? "custom"}</p>
              </div>
              <EmailStatusBadge status={log.status} />
            </div>
          )) : <p className="text-sm text-[var(--color-muted)]">No email activity has been logged yet.</p>}
        </div>
      </Card>
    </AdminShell>
  );
}
