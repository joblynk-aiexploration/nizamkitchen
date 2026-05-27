import { EmailTemplateCategory, EmailTemplateStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { createEmailTemplateAction } from "../../actions";
import { EmailCenterTabs } from "../../_components";

export const dynamic = "force-dynamic";

const categoryOptions = Object.values(EmailTemplateCategory).map((category) => ({ value: category, label: category.replace(/_/g, " ") }));
const statusOptions = Object.values(EmailTemplateStatus).map((status) => ({ value: status, label: status }));

export default async function NewEmailTemplatePage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const params = await searchParams;

  return (
    <AdminShell session={session} title="New email template" description="Create a custom scoped template with HTML and plain-text bodies.">
      <EmailCenterTabs active="/admin/emails/templates" />
      <FormMessage message={params.message} />
      <Card>
        <form action={createEmailTemplateAction} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Template key" name="templateKey" placeholder="custom.weekly_digest" required />
            <TextInput label="Name" name="name" placeholder="Weekly digest" required />
            <SelectInput label="Category" name="category" options={categoryOptions} defaultValue="notification" />
            <SelectInput label="Status" name="status" options={statusOptions} defaultValue="draft" />
            <TextInput label="Locale" name="locale" placeholder="Optional, e.g. en-US" />
            <TextInput label="Country code" name="countryCode" placeholder="Optional, e.g. US" />
          </div>
          <TextArea label="Description" name="description" />
          <TextInput label="Subject" name="subject" placeholder="Your NizamKitchen update" required />
          <TextInput label="Preheader" name="preheader" placeholder="A concise inbox preview." />
          <TextArea label="HTML body" name="htmlBody" required hint="Use simple email-safe HTML. Variables use {{userName}} syntax." />
          <TextArea label="Plain-text body" name="textBody" required hint="Plain-text fallback for email clients and accessibility." />
          <div><Button type="submit">Save template</Button></div>
        </form>
      </Card>
    </AdminShell>
  );
}
