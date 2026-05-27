import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listEmailPreferences } from "@/server/email/email-template-service";
import { EmailCenterTabs } from "../_components";

export const dynamic = "force-dynamic";

export default async function EmailPreferencesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const preferences = await listEmailPreferences(session);

  return (
    <AdminShell session={session} title="Email preferences" description="User-level email preferences for transactional, operational, and marketing categories.">
      <EmailCenterTabs active="/admin/emails/preferences" />
      <Card className="text-sm leading-6 text-[var(--color-muted)]">
        Transactional, legal, payment, and security emails are handled separately from marketing preferences so important account safety messages are not accidentally blocked.
      </Card>
      <AdminDataTable
        data={preferences}
        emptyMessage="No email preferences have been created yet."
        columns={[
          { key: "user", header: "User", render: (preference) => <span className="text-sm font-semibold">{preference.user.fullName ?? preference.user.email}</span> },
          { key: "transactional", header: "Transactional", render: (preference) => <Badge tone={preference.transactionalEnabled ? "success" : "warning"}>{preference.transactionalEnabled ? "Enabled" : "Disabled"}</Badge> },
          { key: "marketing", header: "Marketing", render: (preference) => <Badge tone={preference.marketingEnabled ? "success" : "neutral"}>{preference.marketingEnabled ? "Enabled" : "Disabled"}</Badge> },
          { key: "orders", header: "Orders", render: (preference) => <Badge tone={preference.orderEmails ? "success" : "neutral"}>{preference.orderEmails ? "On" : "Off"}</Badge> },
          { key: "support", header: "Support", render: (preference) => <Badge tone={preference.supportEmails ? "success" : "neutral"}>{preference.supportEmails ? "On" : "Off"}</Badge> },
        ]}
      />
    </AdminShell>
  );
}
