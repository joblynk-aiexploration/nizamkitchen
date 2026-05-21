import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  return (
    <AdminShell session={session} title="CMS / Help Center" description="Public-site content, help articles, FAQs, and support-center editorial workflow.">
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Public help and FAQ pages now render safely. A full CMS editor can be layered here without exposing unfinished links in the sidebar.
        </p>
      </Card>
    </AdminShell>
  );
}
