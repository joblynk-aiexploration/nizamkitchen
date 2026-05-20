import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createLegalDocumentAction } from "../../actions";

export const dynamic = "force-dynamic";

const documentTypes = [
  "user_terms",
  "terms_of_service",
  "privacy_policy",
  "seller_terms",
  "seller_agreement",
  "home_chef_agreement",
  "home_catering_agreement",
  "restaurant_partner_agreement",
  "refund_policy",
  "cancellation_policy",
  "food_safety_policy",
  "background_check_consent",
  "file_upload_policy",
  "marketplace_disclaimer",
  "other",
];

const audiences = ["all_users", "households", "chefs", "home_catering", "restaurants", "admins", "sellers"];

export default async function NewLegalDocumentPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);

  return (
    <AdminShell
      session={session}
      title="New Legal Document"
      description="Create a draft legal document. Published documents are immutable; create a new version for future changes."
      actions={<Button asChild variant="secondary"><Link href="/admin/legal/documents">Back to documents</Link></Button>}
    >
      <Card>
        <form action={createLegalDocumentAction} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Title
              <input name="title" required className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Slug
              <input name="slug" required placeholder="terms-of-service" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Version
              <input name="version" required defaultValue="1.0.0" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Document type
              <select name="documentType" required className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Audience
              <select name="audience" required className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                {audiences.map((audience) => <option key={audience} value={audience}>{audience}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Country code
              <input name="countryCode" placeholder="Optional, e.g. US" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
              Region
              <input name="region" placeholder="Optional state/region" className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
            Markdown content
            <textarea
              name="contentMarkdown"
              required
              rows={16}
              defaultValue={"Template placeholder - replace with final legal counsel-approved text before production.\n\nThis template is not jurisdiction-specific legal advice and is not lawyer-approved."}
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 font-mono text-sm"
            />
          </label>
          <Button type="submit">Create draft</Button>
        </form>
      </Card>
    </AdminShell>
  );
}
