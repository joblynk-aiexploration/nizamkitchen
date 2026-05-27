import { MenuItemForm } from "@/components/menus/menu-forms";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listMenusForOrganization } from "@/server/menus";
import { listEnabledCountryCurrencyOptions } from "@/server/localization/localization-service";
import { upsertRestaurantMenuItemAction } from "../../menu/actions";

export const dynamic = "force-dynamic";

export default async function NewRestaurantMenuItemPage() {
  const session = await requireMembership();
  const [menus, currencies] = await Promise.all([
    listMenusForOrganization(session.activeOrganization.id),
    listEnabledCountryCurrencyOptions(),
  ]);
  const currencyOptions = currencies.map((currency) => ({
    value: currency.currencyCode,
    label: `${currency.currencyCode} - ${currency.displayName}`,
  }));
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title="Add menu item" description="Create a restaurant dish for menu browsing." />
      <MenuItemForm action={upsertRestaurantMenuItemAction} menus={menus} currencyCode={session.activeOrganization.currencyCode} currencyOptions={currencyOptions} />
    </div>
  );
}
