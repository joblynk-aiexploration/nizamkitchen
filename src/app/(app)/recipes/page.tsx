import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { formatTotalTime } from "@/lib/recipe-utils";
import { listCuisines } from "@/server/cuisines";
import { listRecipesPage } from "@/server/recipes";

export const dynamic = "force-dynamic";

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
} as const;

const SPICE_LABELS = {
  mild: "Mild",
  medium: "Medium",
  hot: "Hot",
  extra_hot: "Extra Hot",
} as const;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const isHousehold = session.activeOrganization.organizationType === "household";

  const [recipes, cuisines] = await Promise.all([
    listRecipesPage({
      organizationId: session.activeOrganization.id,
      cuisineId: params.cuisineId,
      difficulty: params.difficulty as never,
      spiceLevel: params.spiceLevel as never,
      countryCode: params.countryCode,
      publishedOnly: true,
      scope: "global_templates",
      page: params.page,
    }),
    listCuisines(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recipe template library"
        title="Global Recipe Templates"
        description={
          isHousehold
            ? "Browse global recipe templates. Add a template to My Recipes before customizing your household version."
            : "Browse global recipe templates. Workspace-owned recipes stay separate from the global library."
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex flex-wrap gap-3">
          <select
            name="cuisineId"
            defaultValue={params.cuisineId ?? ""}
            className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm"
          >
            <option value="">All cuisines</option>
            {cuisines.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            name="difficulty"
            defaultValue={params.difficulty ?? ""}
            className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm"
          >
            <option value="">Any difficulty</option>
            {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            name="spiceLevel"
            defaultValue={params.spiceLevel ?? ""}
            className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm"
          >
            <option value="">Any spice level</option>
            {Object.entries(SPICE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            Filter
          </button>
        </form>
        <Button asChild className="ml-auto">
          <Link href="/recipes/new">{isHousehold ? "Create My Recipe" : "Add recipe"}</Link>
        </Button>
        {isHousehold && (
          <Button asChild variant="secondary">
            <Link href="/recipes/my">My Recipes</Link>
          </Button>
        )}
      </div>

      {recipes.items.length === 0 ? (
        <EmptyState
          title="No global recipes found"
          description="No published global recipe templates match the current filters."
        />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {recipes.items.map((recipe) => (
              <Card key={recipe.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/recipes/${recipe.id}`}
                      className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                    >
                      {recipe.name}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{recipe.cuisine.name}</p>
                  </div>
                  <Badge tone="info">
                    Global template
                  </Badge>
                </div>

                {recipe.description && (
                  <p className="text-sm text-[var(--color-muted)] line-clamp-2">{recipe.description}</p>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">{DIFFICULTY_LABELS[recipe.difficulty]}</Badge>
                  <Badge tone="warning">{SPICE_LABELS[recipe.spiceLevel]}</Badge>
                  <Badge tone="neutral">{formatTotalTime(recipe)}</Badge>
                  <Badge tone="neutral">{recipe.servings} {recipe.servingUnit}s</Badge>
                  {recipe.countryCode && <Badge tone="info">{recipe.countryCode}</Badge>}
                </div>
              </Card>
            ))}
          </div>
          <PaginationControls
            pagination={recipes.pagination}
            basePath="/recipes"
            searchParams={params}
            itemLabel="recipes"
          />
        </>
      )}
    </div>
  );
}
