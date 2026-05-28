import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { ContentTabs, HelpArticleForm } from "../../_content-admin-ui";
import { createHelpArticleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewHelpArticlePage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  return (
    <AdminShell session={session} title="New help article" description="Create help, onboarding, seller, food safety, or support documentation.">
      <ContentTabs />
      <HelpArticleForm action={createHelpArticleAction} />
    </AdminShell>
  );
}
