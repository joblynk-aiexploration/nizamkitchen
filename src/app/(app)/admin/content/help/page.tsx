import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformRole } from "@/lib/auth/session";
import { listHelpArticles } from "@/server/content";
import { ContentTabs, StatusBadge } from "../_content-admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminHelpArticlesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const articles = await listHelpArticles(session);
  return (
    <AdminShell session={session} title="Help articles" description="Manage help center, onboarding, seller, food safety, and support documentation." actions={<Button asChild><Link href="/admin/content/help/new">New article</Link></Button>}>
      <ContentTabs />
      {articles.length === 0 ? <EmptyState title="No help articles" description="Create articles for help center categories and onboarding guides." /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr><th className="py-3 pr-4">Article</th><th className="py-3 pr-4">Category</th><th className="py-3 pr-4">Type</th><th className="py-3 pr-4">Status</th><th className="py-3" /></tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4"><p className="font-semibold text-[var(--color-ink)]">{article.title}</p><p className="text-xs text-[var(--color-muted)]">/help/articles/{article.slug}</p></td>
                  <td className="py-4 pr-4">{article.category}</td>
                  <td className="py-4 pr-4">{article.articleType}</td>
                  <td className="py-4 pr-4"><StatusBadge status={article.status} /></td>
                  <td className="py-4"><Button asChild variant="secondary"><Link href={`/admin/content/help/${article.id}`}>Open</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
