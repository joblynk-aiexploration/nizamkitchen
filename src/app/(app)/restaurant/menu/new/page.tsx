import { MenuForm } from "@/components/menus/menu-forms";
import { PageHeader } from "@/components/ui/page-header";
import { upsertRestaurantMenuAction } from "../actions";

export const dynamic = "force-dynamic";

export default function NewRestaurantMenuPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title="Create menu" description="Draft a restaurant menu before making it public." />
      <MenuForm action={upsertRestaurantMenuAction} />
    </div>
  );
}
