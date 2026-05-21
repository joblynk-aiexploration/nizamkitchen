import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { RestaurantSearchForm } from "@/components/restaurants/restaurant-search-form";
import { getGoogleMapsPublicConfig } from "@/server/maps/google-maps-config";

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
  const mapsConfig = await getGoogleMapsPublicConfig(session.activeOrganization.countryCode);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order Instead"
        title="Find a restaurant"
        description="Search for nearby restaurants serving Hyderabadi and South Asian cuisine."
      />
      <Card className="p-6 max-w-lg">
        {!mapsConfig.enabled ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {mapsConfig.reason} You can still enter a city manually.
          </div>
        ) : null}
        <RestaurantSearchForm
          defaultQuery={defaultQuery}
          defaultCity={defaultCity}
          defaultRecipeId={defaultRecipeId}
          mapsConfig={mapsConfig}
        />
      </Card>
    </div>
  );
}
