import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { CmsPageForm, ContentTabs } from "../../_content-admin-ui";
import { createCmsPageAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewCmsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  return (
    <AdminShell session={session} title="New CMS page" description="Draft or publish a public CMS page.">
      <ContentTabs />
      <CmsPageForm action={createCmsPageAction} />
    </AdminShell>
  );
}
