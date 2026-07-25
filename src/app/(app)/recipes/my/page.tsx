import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { formatTotalTime } from "@/lib/recipe-utils";
import { listCuisines } from "@/server/cuisines";
import { listMyRecipes } from "@/server/recipes";

export const dynamic = "force-dynamic";

export default async function MyRecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const [recipes, cuisines] = await Promise.all([
    listMyRecipes({
      organizationId: session.activeOrganization.id,
      search: params.search,
      cuisineId: params.cuisineId,
      source: params.source as "created" | "customized" | undefined,
    }),
    listCuisines(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Household recipes"
        title="My Recipes"
        description="Your household-owned recipes and private custom copies of global recipes."
        actions={
          <Button asChild>
            <Link href="/recipes/new">Create recipe</Link>
          </Button>
        }
      />

      <Card>
        <form className="flex flex-wrap gap-3">
          <input
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Search My Recipes"
            className="min-h-11 min-w-64 rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm"
          />
          <select
            name="cuisineId"
            defaultValue={params.cuisineId ?? ""}
            className="min-h-11 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm"
          >
            <option value="">All cuisines</option>
            {cuisines.map((cuisine) => (
              <option key={cuisine.id} value={cuisine.id}>{cuisine.name}</option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={params.source ?? ""}
            className="min-h-11 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm"
          >
            <option value="">All sources</option>
            <option value="created">Created by us</option>
            <option value="customized">Customized from global</option>
          </select>
          <Button type="submit">Filter</Button>
          <Button asChild variant="secondary">
            <Link href="/recipes">Browse global recipes</Link>
          </Button>
        </form>
      </Card>

      {recipes.length === 0 ? (
        <EmptyState
          title="No household recipes yet"
          description="Create a recipe or add a global recipe to My Recipes before customizing it."
          action={
            <Button asChild>
              <Link href="/recipes">Browse recipes</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="flex min-h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                  >
                    {recipe.name}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {recipe.cuisine.name} · Updated {recipe.updatedAt.toLocaleDateString("en-US")}
                  </p>
                </div>
                <Badge tone={recipe.sourceRecipeId ? "success" : "neutral"}>
                  {recipe.sourceRecipeId ? "Customized" : "Created"}
                </Badge>
              </div>

              {recipe.description && (
                <p className="line-clamp-3 text-sm text-[var(--color-muted)]">{recipe.description}</p>
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="neutral">{recipe.servings} {recipe.servingUnit}s</Badge>
                <Badge tone="neutral">{formatTotalTime(recipe)}</Badge>
                <Badge tone="info">{recipe._count.ingredients} ingredients</Badge>
                <Badge tone="info">{recipe._count.steps} steps</Badge>
              </div>

              {recipe.sourceRecipe && (
                <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
                  Based on global recipe: {recipe.sourceRecipe.name}
                </p>
              )}

              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Button asChild variant="secondary">
                  <Link href={`/recipes/${recipe.id}`}>View</Link>
                </Button>
                <Button asChild>
                  <Link href={`/recipes/${recipe.id}/edit`}>Edit</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/meal-plans/new?recipeId=${recipe.id}`}>Add to meal plan</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
