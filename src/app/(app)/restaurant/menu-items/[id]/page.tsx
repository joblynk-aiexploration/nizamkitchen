import { notFound } from "next/navigation";
import { MenuItemForm } from "@/components/menus/menu-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getMenuItemForOrganization, listMenusForOrganization } from "@/server/menus";
import { upsertRestaurantMenuItemAction } from "../../menu/actions";

export const dynamic = "force-dynamic";

export default async function RestaurantMenuItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") return <EmptyState title="Restaurant only" description="Menu item tools are available for restaurant organizations." />;
  const { id } = await params;
  const [item, menus] = await Promise.all([
    getMenuItemForOrganization(session.activeOrganization.id, id),
    listMenusForOrganization(session.activeOrganization.id),
  ]);
  if (!item) notFound();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title={item.name} description="Edit dish details, availability, pricing placeholders, and status." />
      <MenuItemForm action={upsertRestaurantMenuItemAction} item={item} menus={menus} currencyCode={session.activeOrganization.currencyCode} />
    </div>
  );
}
