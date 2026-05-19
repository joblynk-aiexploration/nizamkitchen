import { notFound } from "next/navigation";
import { MenuItemForm } from "@/components/menus/menu-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getMenuItemForOrganization, listMenusForOrganization } from "@/server/menus";
import { upsertCateringMenuItemAction } from "../../menu/actions";

export const dynamic = "force-dynamic";

export default async function CateringMenuItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") return <EmptyState title="Home catering only" description="Menu item tools are available for home catering sellers." />;
  const { id } = await params;
  const [item, menus] = await Promise.all([
    getMenuItemForOrganization(session.activeOrganization.id, id),
    listMenusForOrganization(session.activeOrganization.id),
  ]);
  if (!item) notFound();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering" title={item.name} description="Edit dish details, availability, pricing placeholders, and status." />
      <MenuItemForm action={upsertCateringMenuItemAction} item={item} menus={menus} currencyCode={session.activeOrganization.currencyCode} />
    </div>
  );
}
