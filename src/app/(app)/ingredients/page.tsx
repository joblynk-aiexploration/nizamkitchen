import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listIngredients } from "@/server/ingredients";

export const dynamic = "force-dynamic";

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireMembership();
  const params = await searchParams;

  const ingredients = await listIngredients({
    search: params.search,
    category: params.category as never,
    isGlobal: true,
  });

  const categories = [
    "vegetable", "fruit", "meat", "poultry", "seafood", "dairy",
    "grain", "lentil", "spice", "herb", "oil", "condiment",
    "nut", "sweetener", "beverage", "packaged", "other",
];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Food library"
        title="Ingredients"
        description="Global ingredient library with aliases, units, and conversion data used by the recipe and grocery systems."
      />

      <form className="flex flex-wrap gap-3">
        <input
          name="search"
          type="text"
          defaultValue={params.search ?? ""}
          placeholder="Search ingredients or aliases..."
          className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm"
        />
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Filter
        </button>
      </form>

      {ingredients.length === 0 ? (
        <EmptyState title="No ingredients found" description="No ingredients match the current filters." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ingredients.map((ingredient) => (
            <Card key={ingredient.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/ingredients/${ingredient.id}`}
                    className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                  >
                    {ingredient.canonicalName}
                  </Link>
                  {ingredient.name !== ingredient.canonicalName && (
                    <p className="text-xs text-[var(--color-muted)]">{ingredient.name}</p>
                  )}
                </div>
                <Badge tone="neutral">{ingredient.category}</Badge>
              </div>

              {ingredient.aliases.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {ingredient.aliases.slice(0, 4).map((alias) => (
                    <span
                      key={alias.id}
                      className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {alias.alias}
                    </span>
                  ))}
                  {ingredient.aliases.length > 4 && (
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      +{ingredient.aliases.length - 4} more
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                {ingredient.defaultUnit && (
                  <span>Default: {ingredient.defaultUnit.name}</span>
                )}
                {ingredient.averagePieceWeightGrams && (
                  <span>~{ingredient.averagePieceWeightGrams}g/piece</span>
                )}
                {ingredient.densityGramPerMl && (
                  <span>{ingredient.densityGramPerMl} g/ml</span>
                )}
                <span>{ingredient._count.recipeIngredients} recipe uses</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
