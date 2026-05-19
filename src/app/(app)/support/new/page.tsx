import { Button } from "@/components/ui/button";
import { DocumentUploadField } from "@/components/storage/file-upload-field";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { createSupportTicketAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewSupportTicketPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Beta feedback"
        title="Create support ticket"
        description="Include enough detail for the team to reproduce the issue or understand the request."
      />

      <Card>
        <form action={createSupportTicketAction} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectInput
              label="Type"
              name="type"
              options={[
                { value: "bug", label: "Bug" },
                { value: "feedback", label: "Feedback" },
                { value: "feature_request", label: "Feature request" },
                { value: "account_help", label: "Account help" },
                { value: "billing", label: "Billing" },
                { value: "other", label: "Other" },
              ]}
            />
            <SelectInput
              label="Priority"
              name="priority"
              defaultValue="normal"
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
            />
          </div>
          <TextInput label="Title" name="title" placeholder="Short summary" required />
          <TextArea label="Description" name="description" placeholder="What happened? What did you expect?" required />
          <TextInput label="Page URL" name="pageUrl" placeholder="/meal-plans/new or full URL" />
          <TextArea label="Browser info" name="browserInfo" placeholder="Optional: browser, device, screenshot notes, or error text" />
          <DocumentUploadField
            label="Screenshot or attachment"
            name="supportAttachmentFileId"
            module="support"
            purpose="support_attachment"
            visibility="organization"
            entityType="support_ticket"
            hint="Optional. Uploads to S3 and appears in the admin Dropbox for support review."
          />
          <div>
            <Button type="submit">Submit ticket</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
