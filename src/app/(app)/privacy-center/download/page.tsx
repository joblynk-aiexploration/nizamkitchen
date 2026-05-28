import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPrivacyRequestAction } from "../../privacy/actions";

export const dynamic = "force-dynamic";

export default async function PrivacyCenterDownloadPage() {
  await requireMembership();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy center"
        title="Download my data"
        description="Request a private JSON export of your account data. Exports are reviewed and generated without secrets or other users' private data."
        actions={<Button asChild variant="secondary"><Link href="/privacy-center">Back</Link></Button>}
      />
      <Card>
        <form action={createPrivacyRequestAction} className="space-y-5">
          <input type="hidden" name="requestType" value="user_export" />
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Notes for the export reviewer
            <textarea
              name="reason"
              rows={5}
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
              placeholder="Optional: tell us if you need a specific account or organization included."
            />
          </label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Exports include profile, membership, order summaries, support, uploaded file metadata, legal acceptances, and privacy settings. They exclude passwords, session tokens, provider secrets, raw payment payloads, and raw KYC documents.
          </div>
          <Button type="submit">Request data export</Button>
        </form>
      </Card>
    </div>
  );
}
