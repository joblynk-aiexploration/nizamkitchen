import { notFound } from "next/navigation";
import { MenuItemForm } from "@/components/menus/menu-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getMenuItemForOrganization, listMenusForOrganization } from "@/server/menus";
import { listEnabledCountryCurrencyOptions } from "@/server/localization/localization-service";
import { upsertRestaurantMenuItemAction } from "../../menu/actions";

export const dynamic = "force-dynamic";

export default async function RestaurantMenuItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") return <EmptyState title="Restaurant only" description="Menu item tools are available for restaurant organizations." />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [item, menus, currencies] = await Promise.all([
    getMenuItemForOrganization(session.activeOrganization.id, id),
    listMenusForOrganization(session.activeOrganization.id),
    listEnabledCountryCurrencyOptions(),
  ]);
  if (!item) notFound();
  const currencyOptions = currencies.map((currency) => ({
    value: currency.currencyCode,
    label: `${currency.currencyCode} - ${currency.displayName}`,
  }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title={item.name} description="Edit dish details, availability, pricing placeholders, and status." />
      <FormMessage message={query.message} />
      <MenuItemForm action={upsertRestaurantMenuItemAction} item={item} menus={menus} currencyCode={session.activeOrganization.currencyCode} currencyOptions={currencyOptions} />
    </div>
  );
}
