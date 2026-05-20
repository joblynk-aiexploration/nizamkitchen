import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPrivacyRequestAction } from "../../actions";

export const dynamic = "force-dynamic";

const requestTypes = [
  ["user_export", "Export my user data"],
  ["organization_export", "Export my organization data"],
  ["correction_request", "Request a correction"],
  ["account_deletion", "Request account deletion"],
  ["organization_deletion", "Request organization deletion"],
  ["anonymization", "Request anonymization"],
  ["file_deletion", "Request file deletion"],
];

export default async function NewPrivacyRequestPage() {
  await requireMembership();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New privacy request"
        title="Submit a data privacy request"
        description="Requests are reviewed before export, deletion, or anonymization actions are completed."
      />
      <Card>
        <form action={createPrivacyRequestAction} className="space-y-5">
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Request type
            <select name="requestType" required className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
              {requestTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Reason or details
            <textarea name="reason" rows={6} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" placeholder="Tell us what you need changed, exported, or reviewed." />
          </label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Payments, audit logs, disputes, and KYC/background-check records may need to be preserved for legal, security, or accounting reasons.
          </div>
          <Button type="submit">Submit request</Button>
        </form>
      </Card>
    </div>
  );
}
