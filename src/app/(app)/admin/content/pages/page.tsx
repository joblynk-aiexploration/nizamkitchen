import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformRole } from "@/lib/auth/session";
import { listCmsPages } from "@/server/content";
import { ContentTabs, StatusBadge } from "../_content-admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminCmsPagesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const pages = await listCmsPages(session);
  return (
    <AdminShell session={session} title="CMS pages" description="Create public CMS pages and publish them at /pages/[slug]." actions={<Button asChild><Link href="/admin/content/pages/new">New page</Link></Button>}>
      <ContentTabs />
      {pages.length === 0 ? <EmptyState title="No CMS pages" description="Create a page for public content, onboarding, guides, or policy explainers." /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr><th className="py-3 pr-4">Page</th><th className="py-3 pr-4">Audience</th><th className="py-3 pr-4">Country</th><th className="py-3 pr-4">Status</th><th className="py-3" /></tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4"><p className="font-semibold text-[var(--color-ink)]">{page.title}</p><p className="text-xs text-[var(--color-muted)]">/pages/{page.slug}</p></td>
                  <td className="py-4 pr-4">{page.audience}</td>
                  <td className="py-4 pr-4">{page.countryCode ?? "Global"}</td>
                  <td className="py-4 pr-4"><StatusBadge status={page.status} /></td>
                  <td className="py-4"><Button asChild variant="secondary"><Link href={`/admin/content/pages/${page.id}`}>Open</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
