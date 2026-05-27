import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canAccessChefMarketplace, listPublicChefProfiles } from "@/server/chefs";
import { canAccessHomeCatering, listPublicHomeCateringProfiles } from "@/server/home-catering";
import { isHouseholdRequestOrganization } from "@/server/home-chef";
import { getRecipeById } from "@/server/recipes";

export const dynamic = "force-dynamic";

function locationLabel(city?: string | null, region?: string | null) {
  if (city && region) return `${city}, ${region}`;
  if (city) return city;
  if (region) return region;
  return "Service area TBD";
}

function specialtyBadges(items: unknown, fallback?: string | null) {
  if (Array.isArray(items) && items.length > 0) return items.slice(0, 4).map(String);
  return fallback ? [fallback] : [];
}

export default async function RecipeProviderRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ provider?: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const query = await searchParams;
  const recipe = await getRecipeById(id);

  if (!recipe || !recipe.isPublished) notFound();

  if (!isHouseholdRequestOrganization(session.activeOrganization.organizationType)) {
    return (
      <EmptyState
        title="Household requests only"
        description="Chef and caterer requests are available from household accounts."
      />
    );
  }

  const [chefMarketplaceEnabled, cateringEnabled] = await Promise.all([
    canAccessChefMarketplace({
      organizationId: session.activeOrganization.id,
      platformRole: session.user.platformRole,
    }),
    canAccessHomeCatering({
      organizationId: session.activeOrganization.id,
      platformRole: session.user.platformRole,
    }),
  ]);

  const provider = query.provider;
  const showChefList = provider === "home-chef";
  const showCatererList = provider === "caterer";

  const [chefs, caterers] = await Promise.all([
    showChefList && chefMarketplaceEnabled
      ? listPublicChefProfiles({
          organizationId: session.activeOrganization.id,
          verifiedOnly: true,
        })
      : Promise.resolve([]),
    showCatererList && cateringEnabled
      ? listPublicHomeCateringProfiles({
          organizationId: session.activeOrganization.id,
        })
      : Promise.resolve([]),
  ]);
  const verifiedCaterers = caterers.filter((profile) => profile.verificationStatus === "verified");
  const catererOrgIds = verifiedCaterers.map((profile) => profile.organizationId);
  const matchingMenuItems = catererOrgIds.length
    ? await prisma.menuItem.findMany({
        where: {
          organizationId: { in: catererOrgIds },
          status: "active",
          menu: { status: "active", visibility: "public" },
          OR: [
            { name: { contains: recipe.name, mode: "insensitive" } },
            { description: { contains: recipe.name, mode: "insensitive" } },
            { cuisine: { contains: recipe.cuisine.name, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, organizationId: true },
        orderBy: { name: "asc" },
      })
    : [];
  const menuItemByOrganizationId = new Map(matchingMenuItems.map((item) => [item.organizationId, item]));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recipe request"
        title={`Who should cook ${recipe.name}?`}
        description="Choose a home chef who comes to your house, or a caterer who prepares food at their own kitchen for pickup or delivery. Only verified providers are shown here."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/recipes/${recipe.id}`}>Back to recipe</Link>
          </Button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Link href={`/recipes/${recipe.id}/request?provider=home-chef`} className="block">
          <Card className={`h-full transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 ${showChefList ? "border-[var(--color-primary)] bg-emerald-50/40" : ""}`}>
            <Badge tone="success">Home chef</Badge>
            <h2 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">A home chef comes to your house and cooks</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Pick a verified chef, then fill out the date, time, guest count, address, and notes for this recipe.
            </p>
          </Card>
        </Link>
        <Link href={`/recipes/${recipe.id}/request?provider=caterer`} className="block">
          <Card className={`h-full transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 ${showCatererList ? "border-[var(--color-primary)] bg-emerald-50/40" : ""}`}>
            <Badge tone="info">Caterer</Badge>
            <h2 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">A caterer cooks at their place for pickup or delivery</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Browse verified home caterers and restaurant caterers, then order from their available public menu items.
            </p>
          </Card>
        </Link>
      </div>

      {showChefList ? (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">Verified home chefs</h2>
          {!chefMarketplaceEnabled ? (
            <EmptyState title="Home chefs are not available" description="Home chef browsing is currently disabled for this household." />
          ) : chefs.length === 0 ? (
            <EmptyState title="No verified chefs found" description="No verified chefs are available yet. You can still send a general home chef request." action={<Button asChild><Link href={`/home-chef/request?type=recipe&recipeId=${recipe.id}`}>Create general request</Link></Button>} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {chefs.map((chef) => (
                <Card key={chef.id} className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--color-ink)]">{chef.displayName}</h3>
                      <p className="mt-1 text-sm font-medium text-[var(--color-muted)]">{chef.organization.name}</p>
                    </div>
                    <Badge tone="success">Verified</Badge>
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-muted)]">{locationLabel(chef.baseCity, chef.baseRegion)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {specialtyBadges(chef.specialties, recipe.cuisine.name).map((item) => <Badge key={item} tone="info">{item}</Badge>)}
                  </div>
                  <Button className="mt-5 w-full justify-center" asChild>
                    <Link href={`/chefs/${chef.slug}/request?recipeId=${recipe.id}`}>Request this chef</Link>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showCatererList ? (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">Verified caterers</h2>
          {!cateringEnabled ? (
            <EmptyState title="Home catering is not available" description="Home catering browsing is currently disabled for this household." />
          ) : verifiedCaterers.length === 0 ? (
            <EmptyState title="No verified caterers found" description="No verified caterers are available yet. Try browsing all caterers or choose a home chef instead." action={<Button asChild><Link href="/caterers">Browse caterers</Link></Button>} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {verifiedCaterers.map((caterer) => {
                const menuItem = menuItemByOrganizationId.get(caterer.organizationId);
                return (
                  <Card key={caterer.id} className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--color-ink)]">{caterer.displayName}</h3>
                        <p className="mt-1 text-sm font-medium text-[var(--color-muted)]">{caterer.organization.name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge tone="success">Verified</Badge>
                        <Badge tone="info">{caterer.operationType === "restaurant_caterer" ? "Restaurant caterer" : "Home caterer"}</Badge>
                      </div>
                    </div>
                    {caterer.operationType === "restaurant_caterer" && caterer.restaurantName ? (
                      <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">Prepared by {caterer.restaurantName}</p>
                    ) : null}
                    <p className="mt-3 text-sm text-[var(--color-muted)]">{locationLabel(caterer.city, caterer.region)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {specialtyBadges(caterer.cuisineSpecialtiesJson, recipe.cuisine.name).map((item) => <Badge key={item} tone="info">{item}</Badge>)}
                    </div>
                    {menuItem ? (
                      <Button className="mt-5 w-full justify-center" asChild>
                        <Link href={`/orders/new?menuItemId=${menuItem.id}`}>Place order for {menuItem.name}</Link>
                      </Button>
                    ) : (
                      <Button className="mt-5 w-full justify-center" variant="secondary" asChild>
                        <Link href={`/caterers/${caterer.slug}`}>View menu and order</Link>
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
