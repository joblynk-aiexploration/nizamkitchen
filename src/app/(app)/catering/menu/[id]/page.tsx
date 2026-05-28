import { notFound } from "next/navigation";
import { MenuForm } from "@/components/menus/menu-forms";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getMenuForOrganization } from "@/server/menus";
import { upsertCateringMenuAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CateringMenuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") return <EmptyState title="Home catering only" description="Menu builder is available for home catering sellers." />;
  const { id } = await params;
  const menu = await getMenuForOrganization(session.activeOrganization.id, id);
  if (!menu) notFound();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering" title={menu.name} description="Edit menu details and review attached dishes." />
      <MenuForm action={upsertCateringMenuAction} menu={menu} />
      <Card>
        <h2 className="text-lg font-semibold">Menu items</h2>
        <div className="mt-5 space-y-3">
          {menu.items.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No dishes linked yet.</p> : null}
          {menu.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] p-4">
              <div><p className="font-semibold">{item.name}</p><p className="text-sm text-[var(--color-muted)]">{item.category}</p></div>
              <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
