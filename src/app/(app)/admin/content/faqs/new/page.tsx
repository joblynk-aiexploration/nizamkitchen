import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { ContentTabs, FaqItemForm } from "../../_content-admin-ui";
import { createFaqItemAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewFaqPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  return (
    <AdminShell session={session} title="New FAQ" description="Create a public FAQ answer with optional category, audience, and country targeting.">
      <ContentTabs />
      <FaqItemForm action={createFaqItemAction} />
    </AdminShell>
  );
}
