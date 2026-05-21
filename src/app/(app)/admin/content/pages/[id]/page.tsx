import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarkdownView } from "@/components/content/markdown-view";
import { requirePlatformRole } from "@/lib/auth/session";
import { getCmsPageForAdmin } from "@/server/content";
import { CmsPageForm, ContentTabs } from "../../_content-admin-ui";
import { updateCmsPageAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CmsPageDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const { id } = await params;
  const page = await getCmsPageForAdmin(session, id);
  if (!page) notFound();
  return (
    <AdminShell session={session} title={page.title} description="Edit, publish, archive, and preview this CMS page." actions={page.status === "published" ? <Button asChild variant="secondary"><Link href={`/pages/${page.slug}`}>Preview public page</Link></Button> : null}>
      <ContentTabs />
      <CmsPageForm action={updateCmsPageAction} page={page} />
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Preview</h2>
        <MarkdownView content={page.contentMarkdown} />
      </Card>
    </AdminShell>
  );
}
