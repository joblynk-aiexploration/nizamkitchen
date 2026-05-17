import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessFamilyProfiles, listFavoriteRecipes } from "@/server/household";
import { removeFavoriteRecipeAction } from "../actions";
import { ComingSoonFamilyProfiles, HouseholdNav, NonHouseholdState } from "../_components";

export const dynamic = "force-dynamic";

export default async function HouseholdFavoritesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const { message } = await searchParams;
  const org = session.activeOrganization;
  const enabled = await canAccessFamilyProfiles({ organizationId: org.id, platformRole: session.user.platformRole });
  if (!enabled) return <ComingSoonFamilyProfiles />;
  if (org.organizationType !== "household") return <NonHouseholdState organizationType={org.organizationType} />;

  const favorites = await listFavoriteRecipes(org.id);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Household" title="Favorite recipes" description="Organization-scoped recipes your household wants to find quickly while planning." />
      <HouseholdNav />
      <FormMessage message={message} />
      {favorites.length === 0 ? (
        <Card><p className="text-sm text-[var(--color-muted)]">No favorites yet. Open a recipe and use the Favorite button.</p></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {favorites.map((favorite) => (
            <Card key={favorite.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{favorite.recipe.cuisine.name}</p>
              <h2 className="mt-2 font-serif text-xl font-semibold">{favorite.recipe.name}</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{favorite.recipe.description}</p>
              <div className="mt-4 flex gap-2">
                <Button asChild variant="secondary"><Link href={`/recipes/${favorite.recipeId}`}>Open recipe</Link></Button>
                <form action={removeFavoriteRecipeAction}>
                  <input type="hidden" name="recipeId" value={favorite.recipeId} />
                  <Button type="submit" variant="ghost">Remove</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
