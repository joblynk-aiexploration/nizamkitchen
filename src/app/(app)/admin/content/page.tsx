import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getContentDashboard } from "@/server/content";
import { ContentTabs } from "./_content-admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const dashboard = await getContentDashboard(session);
  return (
    <AdminShell session={session} title="CMS / Help Center" description="Public-site content, help articles, FAQs, and support-center editorial workflow.">
      <ContentTabs />
      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="CMS pages" value={dashboard.pages.length} href="/admin/content/pages" />
        <Metric title="Help articles" value={dashboard.helpArticles.length} href="/admin/content/help" />
        <Metric title="FAQs" value={dashboard.faqs.length} href="/admin/content/faqs" />
      </div>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Editorial controls</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Platform content can be drafted, published, archived, targeted by audience/country, reordered, and previewed through public routes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild><Link href="/admin/content/pages/new">New page</Link></Button>
          <Button asChild variant="secondary"><Link href="/admin/content/help/new">New help article</Link></Button>
          <Button asChild variant="secondary"><Link href="/admin/content/faqs/new">New FAQ</Link></Button>
        </div>
      </Card>
    </AdminShell>
  );
}

function Metric({ title, value, href }: { title: string; value: number; href: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
      <Button asChild variant="secondary" className="mt-4"><Link href={href}>Manage</Link></Button>
    </Card>
  );
}
