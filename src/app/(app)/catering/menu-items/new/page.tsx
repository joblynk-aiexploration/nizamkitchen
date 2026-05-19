import { MenuItemForm } from "@/components/menus/menu-forms";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listMenusForOrganization } from "@/server/menus";
import { upsertCateringMenuItemAction } from "../../menu/actions";

export const dynamic = "force-dynamic";

export default async function NewCateringMenuItemPage() {
  const session = await requireMembership();
  const menus = await listMenusForOrganization(session.activeOrganization.id);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering" title="Add menu item" description="Create a dish, tray, side, dessert, or special for your home catering menu." />
      <MenuItemForm action={upsertCateringMenuItemAction} menus={menus} currencyCode={session.activeOrganization.currencyCode} />
    </div>
  );
}
