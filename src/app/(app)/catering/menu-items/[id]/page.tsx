import { notFound } from "next/navigation";
import { MenuItemForm } from "@/components/menus/menu-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getMenuItemForOrganization, listMenusForOrganization } from "@/server/menus";
import { listEnabledCountryCurrencyOptions } from "@/server/localization/localization-service";
import { upsertCateringMenuItemAction } from "../../menu/actions";

export const dynamic = "force-dynamic";

export default async function CateringMenuItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") return <EmptyState title="Home catering only" description="Menu item tools are available for home catering sellers." />;
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
      <PageHeader eyebrow="Home catering" title={item.name} description="Edit dish details, availability, pricing placeholders, and status." />
      <FormMessage message={query.message} />
      <MenuItemForm action={upsertCateringMenuItemAction} item={item} menus={menus} currencyCode={session.activeOrganization.currencyCode} currencyOptions={currencyOptions} />
    </div>
  );
}
