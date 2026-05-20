import Link from "next/link";
import { getLatestPublishedLegalDocument } from "@/server/legal/legal-service";

export async function LegalDocumentPage({
  slug,
  fallbackTitle,
}: {
  slug: string;
  fallbackTitle: string;
}) {
  const document = await getLatestPublishedLegalDocument({ slug });

  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">Back to NizamKitchen</Link>
        <div className="mt-8 rounded-3xl border border-[var(--color-border)] bg-white p-8 shadow-sm">
          {!document ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Not published yet</p>
              <h1 className="mt-3 font-serif text-4xl text-[var(--color-ink)]">{fallbackTitle}</h1>
              <p className="mt-4 text-[var(--color-muted)]">
                This legal document has not been published yet. Please contact NizamKitchen support if you need this policy before continuing.
              </p>
            </div>
          ) : (
            <article>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                Version {document.version}{document.effectiveAt ? ` · effective ${document.effectiveAt.toLocaleDateString()}` : ""}
              </p>
              <h1 className="mt-3 font-serif text-4xl text-[var(--color-ink)]">{document.title}</h1>
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                These templates are placeholders for operational readiness and must be replaced with final legal counsel-approved text before production.
              </div>
              <pre className="mt-8 whitespace-pre-wrap font-sans text-sm leading-7 text-[var(--color-ink)]">{document.contentMarkdown}</pre>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
