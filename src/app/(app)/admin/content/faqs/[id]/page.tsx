import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { MarkdownView } from "@/components/content/markdown-view";
import { requirePlatformRole } from "@/lib/auth/session";
import { getFaqItemForAdmin } from "@/server/content";
import { ContentTabs, FaqItemForm } from "../../_content-admin-ui";
import { updateFaqItemAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function FaqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const { id } = await params;
  const faq = await getFaqItemForAdmin(session, id);
  if (!faq) notFound();
  return (
    <AdminShell session={session} title={faq.question} description="Edit, publish, archive, and reorder this FAQ.">
      <ContentTabs />
      <FaqItemForm action={updateFaqItemAction} faq={faq} />
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Answer preview</h2>
        <MarkdownView content={faq.answerMarkdown} />
      </Card>
    </AdminShell>
  );
}
