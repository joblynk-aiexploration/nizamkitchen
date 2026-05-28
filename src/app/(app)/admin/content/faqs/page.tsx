import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformRole } from "@/lib/auth/session";
import { listFaqItems } from "@/server/content";
import { ContentTabs, StatusBadge } from "../_content-admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const faqs = await listFaqItems(session);
  return (
    <AdminShell session={session} title="FAQs" description="Manage public FAQ items, categories, audience targeting, and sort order." actions={<Button asChild><Link href="/admin/content/faqs/new">New FAQ</Link></Button>}>
      <ContentTabs />
      {faqs.length === 0 ? <EmptyState title="No FAQs" description="Create frequently asked questions for public support pages." /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr><th className="py-3 pr-4">Question</th><th className="py-3 pr-4">Category</th><th className="py-3 pr-4">Audience</th><th className="py-3 pr-4">Status</th><th className="py-3" /></tr>
            </thead>
            <tbody>
              {faqs.map((faq) => (
                <tr key={faq.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4 font-semibold text-[var(--color-ink)]">{faq.question}</td>
                  <td className="py-4 pr-4">{faq.category ?? "General"}</td>
                  <td className="py-4 pr-4">{faq.audience}</td>
                  <td className="py-4 pr-4"><StatusBadge status={faq.status} /></td>
                  <td className="py-4"><Button asChild variant="secondary"><Link href={`/admin/content/faqs/${faq.id}`}>Open</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
