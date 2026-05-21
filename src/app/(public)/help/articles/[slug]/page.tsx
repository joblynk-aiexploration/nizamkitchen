import { notFound } from "next/navigation";
import { MarkdownView } from "@/components/content/markdown-view";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getPublishedHelpArticle } from "@/server/content";

export const dynamic = "force-dynamic";

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublishedHelpArticle(slug);
  if (!article) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-16">
      <PageHeader eyebrow={`Help / ${article.category}`} title={article.title} description={article.excerpt ?? "Help center article."} />
      <Card>
        <MarkdownView content={article.contentMarkdown} />
      </Card>
    </div>
  );
}
