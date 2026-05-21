import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listPublishedHelpArticlesByCategory } from "@/server/content";

export const dynamic = "force-dynamic";

export default async function HelpCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const articles = await listPublishedHelpArticlesByCategory(category);
  if (articles.length === 0) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-16">
      <PageHeader eyebrow="Help center" title={articles[0]?.category ?? category} description="Browse help articles and guides for this topic." />
      <div className="grid gap-4 md:grid-cols-2">
        {articles.map((article) => (
          <Card key={article.id}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">{article.articleType.replace(/_/g, " ")}</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{article.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{article.excerpt ?? "Read the full guide."}</p>
            <Button asChild variant="secondary" className="mt-4"><Link href={`/help/articles/${article.slug}`}>Read article</Link></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
