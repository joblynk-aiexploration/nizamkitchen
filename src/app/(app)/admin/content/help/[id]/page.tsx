import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownView } from "@/components/content/markdown-view";
import { requirePlatformRole } from "@/lib/auth/session";
import { getHelpArticleForAdmin } from "@/server/content";
import { ContentTabs, HelpArticleForm } from "../../_content-admin-ui";
import { updateHelpArticleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function HelpArticleDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const { id } = await params;
  const article = await getHelpArticleForAdmin(session, id);
  if (!article) notFound();
  return (
    <AdminShell session={session} title={article.title} description="Edit, publish, archive, reorder, and preview this help article." actions={article.status === "published" ? <Button asChild variant="secondary"><Link href={`/help/articles/${article.slug}`}>Preview public article</Link></Button> : null}>
      <ContentTabs />
      <HelpArticleForm action={updateHelpArticleAction} article={article} />
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Preview</h2>
        <MarkdownView content={article.contentMarkdown} />
      </Card>
    </AdminShell>
  );
}
