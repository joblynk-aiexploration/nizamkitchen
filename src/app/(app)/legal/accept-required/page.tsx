import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { hasAcceptedLatestRequiredDocuments } from "@/server/legal/legal-service";
import { acceptRequiredLegalDocumentsAction } from "../actions";

export const dynamic = "force-dynamic";

function publicHrefForSlug(slug: string) {
  const publicSlugs: Record<string, string> = {
    "terms-of-service": "/legal/terms",
    "privacy-policy": "/legal/privacy",
    "refund-policy": "/legal/refund-policy",
    "cancellation-policy": "/legal/cancellation-policy",
    "food-safety-policy": "/legal/food-safety",
    "seller-agreement": "/legal/seller-agreement",
  };
  return publicSlugs[slug] ?? `/legal/${slug}`;
}

export default async function AcceptRequiredLegalPage() {
  const session = await requireUser();
  const result = await hasAcceptedLatestRequiredDocuments(session);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Legal update</p>
        <h1 className="mt-3 font-serif text-3xl text-[var(--color-ink)]">Updated terms require your acceptance.</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Review the latest required documents for {session.activeOrganization?.name ?? "your account"} before continuing.
          These templates are placeholders and should be replaced with final legal counsel-approved text before production.
        </p>
      </Card>

      <Card>
        {result.accepted ? (
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">You are up to date.</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">All required legal documents have been accepted.</p>
            <Button asChild className="mt-5"><Link href="/dashboard">Continue</Link></Button>
          </div>
        ) : (
          <div className="space-y-5">
            <h2 className="font-semibold text-[var(--color-ink)]">Required documents</h2>
            <div className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)]">
              {result.missing.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{document.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">Version {document.version} · {document.audience}</p>
                  </div>
                  <Link href={publicHrefForSlug(document.slug)} className="font-semibold text-[var(--color-primary)] hover:underline">
                    Read document
                  </Link>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              By accepting, you acknowledge the current version shown above. Declining signs you out so you can return later.
            </div>
            <div className="flex flex-wrap gap-3">
              <form action={acceptRequiredLegalDocumentsAction}>
                <Button type="submit">Accept and continue</Button>
              </form>
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="secondary">Decline and sign out</Button>
              </form>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
