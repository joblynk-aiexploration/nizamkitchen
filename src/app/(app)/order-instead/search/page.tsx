import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { RestaurantSearchForm } from "@/components/restaurants/restaurant-search-form";

export const dynamic = "force-dynamic";

export default async function OrderInsteadSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const orgId = session.activeOrganization.id;
  const enabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!enabled) redirect("/order-instead");

  const params = await searchParams;
  const defaultQuery = params.q ?? params.query ?? "";
  const defaultCity = params.city ?? "";
  const defaultRecipeId = params.recipeId ?? undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order Instead"
        title="Find a restaurant"
        description="Search for nearby restaurants serving Hyderabadi and South Asian cuisine."
      />
      <Card className="p-6 max-w-lg">
        <RestaurantSearchForm
          defaultQuery={defaultQuery}
          defaultCity={defaultCity}
          defaultRecipeId={defaultRecipeId}
        />
      </Card>
    </div>
  );
}
