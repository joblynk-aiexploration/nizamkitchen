import { EmailSuppressionReason, EmailTemplateCategory } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import { listEmailSuppressions } from "@/server/email/email-template-service";
import { createEmailSuppressionAction } from "../actions";
import { EmailCenterTabs } from "../_components";

export const dynamic = "force-dynamic";

const reasonOptions = Object.values(EmailSuppressionReason).map((reason) => ({ value: reason, label: reason.replace(/_/g, " ") }));
const categoryOptions = [
  { value: "", label: "All categories" },
  ...Object.values(EmailTemplateCategory).map((category) => ({ value: category, label: category.replace(/_/g, " ") })),
];

export default async function EmailSuppressionsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const [query, suppressions] = await Promise.all([searchParams, listEmailSuppressions(session)]);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Email suppressions" description="Manage opt-outs, bounces, complaints, invalid addresses, and admin-suppressed recipients.">
      <EmailCenterTabs active="/admin/emails/suppressions" />
      <FormMessage message={query.message} />
      {canManage ? (
        <Card>
          <form action={createEmailSuppressionAction} className="grid gap-4 md:grid-cols-[1fr_220px_220px_auto] md:items-end">
            <TextInput label="Email" name="email" type="email" required />
            <SelectInput label="Reason" name="reason" options={reasonOptions} defaultValue="admin_suppressed" />
            <SelectInput label="Category" name="category" options={categoryOptions} defaultValue="" />
            <Button type="submit">Add suppression</Button>
          </form>
        </Card>
      ) : null}
      <AdminDataTable
        data={suppressions}
        emptyMessage="No email suppressions found."
        columns={[
          { key: "email", header: "Email", render: (item) => <span className="font-semibold">{item.email}</span> },
          { key: "reason", header: "Reason", render: (item) => <Badge tone="warning">{item.reason}</Badge> },
          { key: "category", header: "Category", render: (item) => <span className="text-sm">{item.category ?? "All"}</span> },
          { key: "created", header: "Created", render: (item) => <span className="text-sm text-[var(--color-muted)]">{formatDate(item.createdAt)}</span> },
        ]}
      />
    </AdminShell>
  );
}
