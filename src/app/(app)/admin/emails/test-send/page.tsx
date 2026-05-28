import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listEmailTemplates } from "@/server/email/email-template-service";
import { sendTestEmailAction } from "../actions";
import { EmailCenterTabs } from "../_components";

export const dynamic = "force-dynamic";

export default async function EmailTestSendPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const [query, templates] = await Promise.all([searchParams, listEmailTemplates(session)]);
  const activeTemplates = templates.filter((template) => template.status === "active");

  return (
    <AdminShell session={session} title="Test email send" description="Send a safe template test using example variables. Delivery status is recorded in email logs.">
      <EmailCenterTabs active="/admin/emails/test-send" />
      <FormMessage message={query.message} />
      <Card className="text-sm leading-6 text-[var(--color-muted)]">
        If SMTP is missing or disabled, this test will not crash. It will create a skipped email log so the setup state is clear.
      </Card>
      <Card>
        <form action={sendTestEmailAction} className="grid gap-4 md:grid-cols-2">
          <TextInput label="Recipient email" name="recipientEmail" type="email" defaultValue={session.user.email} required />
          <SelectInput
            label="Template"
            name="templateKey"
            options={activeTemplates.map((template) => ({ value: template.templateKey, label: `${template.name} (${template.templateKey})` }))}
            defaultValue={activeTemplates[0]?.templateKey}
          />
          <TextInput label="Country code" name="countryCode" placeholder="Optional, e.g. US" />
          <div className="flex items-end">
            <Button type="submit">Send test email</Button>
          </div>
        </form>
      </Card>
    </AdminShell>
  );
}
