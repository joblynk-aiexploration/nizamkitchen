import Link from "next/link";
import type { ReactNode } from "react";
import { getLatestPublishedLegalDocument } from "@/server/legal/legal-service";

function renderLegalMarkdown(markdown: string, documentTitle: string) {
  const blocks: ReactNode[] = [];
  const listItems: string[] = [];

  function flushList() {
    if (!listItems.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-4 list-disc space-y-2 pl-6 text-sm leading-7 text-[var(--color-ink)]">
        {listItems.splice(0).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>,
    );
  }

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }

    flushList();

    if (line.startsWith("# ")) {
      if (line.slice(2).trim().toLowerCase() === documentTitle.trim().toLowerCase()) {
        continue;
      }

      blocks.push(
        <h2 key={`h1-${blocks.length}`} className="mt-8 font-serif text-3xl text-[var(--color-ink)]">
          {line.slice(2)}
        </h2>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={`h2-${blocks.length}`} className="mt-8 text-xl font-semibold text-[var(--color-ink)]">
          {line.slice(3)}
        </h3>,
      );
      continue;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="mt-4 text-sm leading-7 text-[var(--color-ink)]">
        {line.replaceAll("**", "")}
      </p>,
    );
  }

  flushList();
  return blocks;
}

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
              <div className="mt-8">{renderLegalMarkdown(document.contentMarkdown, document.title)}</div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
