import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePlatformRole } from "@/lib/auth/session";
import { listEmailTemplates } from "@/server/email/email-template-service";
import { EmailCenterTabs, EmailStatusBadge } from "../_components";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const templates = await listEmailTemplates(session);

  return (
    <AdminShell
      session={session}
      title="Email templates"
      description="Versioned HTML and plain-text templates for transactional, operational, and marketing-safe email communications."
      actions={<Button asChild><Link href="/admin/emails/templates/new">New template</Link></Button>}
    >
      <EmailCenterTabs active="/admin/emails/templates" />
      <AdminDataTable
        data={templates}
        emptyMessage="No email templates have been created yet."
        columns={[
          {
            key: "template",
            header: "Template",
            render: (template) => (
              <div>
                <Link href={`/admin/emails/templates/${template.id}`} className="font-semibold text-[var(--color-primary)]">{template.name}</Link>
                <p className="text-xs text-[var(--color-muted)]">{template.templateKey} · v{template.version}</p>
              </div>
            ),
          },
          { key: "category", header: "Category", render: (template) => <Badge tone="neutral">{template.category}</Badge> },
          { key: "status", header: "Status", render: (template) => <EmailStatusBadge status={template.status} /> },
          { key: "scope", header: "Scope", render: (template) => <span className="text-sm">{template.countryCode ?? "Global"}{template.locale ? ` · ${template.locale}` : ""}</span> },
          { key: "variables", header: "Variables", render: (template) => <span className="text-sm">{template._count.variables}</span> },
          { key: "system", header: "Type", render: (template) => <Badge tone={template.isSystem ? "info" : "neutral"}>{template.isSystem ? "System" : "Custom"}</Badge> },
        ]}
      />
    </AdminShell>
  );
}
