import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { formatTotalTime, formatQuantity, groupIngredientsBySection } from "@/lib/recipe-utils";
import { getRecipeById } from "@/server/recipes";
import { FULL_PLATFORM_ADMIN_ROLES, hasPlatformRole } from "@/lib/auth";

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

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const recipe = await getRecipeById(id);

  if (!recipe || !recipe.isPublished) {
    notFound();
  }

  const canEdit = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES) ||
    (recipe.organizationId === session.activeOrganization.id);

  const sections = groupIngredientsBySection(recipe.ingredients);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={recipe.cuisine.name}
        title={recipe.name}
        description={recipe.description ?? ""}
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{DIFFICULTY_LABELS[recipe.difficulty]}</Badge>
        <Badge tone="warning">{SPICE_LABELS[recipe.spiceLevel]}</Badge>
        <Badge tone="neutral">Prep: {recipe.prepMinutes}m</Badge>
        <Badge tone="neutral">Cook: {recipe.cookMinutes}m</Badge>
        <Badge tone="neutral">Total: {formatTotalTime(recipe)}</Badge>
        <Badge tone="neutral">{recipe.servings} {recipe.servingUnit}s</Badge>
        {recipe.isGlobal && <Badge tone="info">global recipe</Badge>}
        {recipe.countryCode && <Badge tone="info">{recipe.countryCode}</Badge>}
        {recipe.dietaryTags.map(({ dietaryTag }) => (
          <Badge key={dietaryTag.id} tone="success">{dietaryTag.name}</Badge>
        ))}
        {canEdit && (
          <Button asChild variant="secondary" className="ml-auto">
            <Link href={`/recipes/${recipe.id}/edit`}>Edit recipe</Link>
          </Button>
        )}
      </div>

      {recipe.story && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">About this recipe</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">{recipe.story}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Ingredients</h2>
            {Array.from(sections.entries()).map(([section, items]) => (
              <div key={section} className="mt-4">
                {sections.size > 1 && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {section}
                  </p>
                )}
                <ul className="space-y-2">
                  {items.map((ri) => (
                    <li key={ri.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-[var(--color-ink)]">
                        {formatQuantity(ri.quantity, ri.unit)}
                      </span>
                      <span className="text-[var(--color-muted)]">
                        <Link href={`/ingredients/${ri.ingredientId}`} className="hover:text-[var(--color-primary)]">
                          {ri.ingredient.name}
                        </Link>
                        {ri.preparationNote && (
                          <span className="italic">, {ri.preparationNote}</span>
                        )}
                        {ri.isOptional && (
                          <Badge tone="neutral">optional</Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Steps</h2>
          {recipe.steps.map((step) => (
            <Card key={step.id}>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                  {step.stepNumber}
                </div>
                <div className="min-w-0 flex-1">
                  {step.title && (
                    <p className="font-semibold text-[var(--color-ink)]">{step.title}</p>
                  )}
                  <p className="mt-1 text-sm text-[var(--color-ink)]">{step.instruction}</p>
                  {step.durationMinutes && (
                    <p className="mt-2 text-xs text-[var(--color-muted)]">
                      ~{step.durationMinutes} min
                    </p>
                  )}
                  {step.tips && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Tip: {step.tips}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {recipe.mediaRefs.length > 0 && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">References</h2>
          <div className="mt-4 space-y-2">
            {recipe.mediaRefs.map((ref) => (
              <a
                key={ref.id}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] p-3 text-sm hover:bg-slate-50"
              >
                <Badge tone="info">{ref.type}</Badge>
                <span className="font-medium text-[var(--color-primary)]">{ref.title}</span>
                {ref.provider && (
                  <span className="text-[var(--color-muted)]">via {ref.provider}</span>
                )}
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
