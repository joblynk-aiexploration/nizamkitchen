import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownView } from "@/components/content/markdown-view";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getPublishedCmsPage } from "@/server/content";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedCmsPage(slug);
  return {
    title: page?.metaTitle ?? page?.title ?? "NizamKitchen",
    description: page?.metaDescription ?? page?.excerpt ?? undefined,
  };
}

export default async function PublicCmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedCmsPage(slug);
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-16">
      <PageHeader eyebrow="NizamKitchen" title={page.title} description={page.excerpt ?? "NizamKitchen public content."} />
      <Card>
        <MarkdownView content={page.contentMarkdown} />
      </Card>
    </div>
  );
}
