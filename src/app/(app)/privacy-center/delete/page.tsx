import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPrivacyRequestAction } from "../../privacy/actions";

export const dynamic = "force-dynamic";

const requestOptions = [
  ["account_deletion", "Request account deletion"],
  ["anonymization", "Request anonymization"],
  ["correction_request", "Request data correction"],
  ["file_deletion", "Request file deletion review"],
];

export default async function PrivacyCenterDeletePage() {
  await requireMembership();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy center"
        title="Deletion and correction requests"
        description="Submit a reviewed request. NizamKitchen preserves payment, audit, active order, and required compliance records when policy requires it."
        actions={<Button asChild variant="secondary"><Link href="/privacy-center">Back</Link></Button>}
      />
      <Card>
        <form action={createPrivacyRequestAction} className="space-y-5">
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Request type
            <select name="requestType" required className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
              {requestOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Details
            <textarea
              name="reason"
              rows={6}
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
              placeholder="Tell us what you want reviewed, corrected, deleted, or anonymized."
            />
          </label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This does not immediately delete your account. A platform admin reviews the request and applies retention rules before anything is anonymized or archived.
          </div>
          <Button type="submit">Submit request</Button>
        </form>
      </Card>
    </div>
  );
}
