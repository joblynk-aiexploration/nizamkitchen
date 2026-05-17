import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getIngredientById } from "@/server/ingredients";

export const dynamic = "force-dynamic";

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMembership();
  const { id } = await params;
  const ingredient = await getIngredientById(id);

  if (!ingredient || !ingredient.isActive) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ingredient"
        title={ingredient.canonicalName}
        description={`Category: ${ingredient.category}`}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Category</dt>
                <dd><Badge tone="neutral">{ingredient.category}</Badge></dd>
              </div>
              {ingredient.defaultUnit && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Default unit</dt>
                  <dd className="font-medium">{ingredient.defaultUnit.name}</dd>
                </div>
              )}
              {ingredient.averagePieceWeightGrams && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Avg piece weight</dt>
                  <dd className="font-medium">{ingredient.averagePieceWeightGrams}g</dd>
                </div>
              )}
              {ingredient.densityGramPerMl && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Density</dt>
                  <dd className="font-medium">{ingredient.densityGramPerMl} g/ml</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Scope</dt>
                <dd><Badge tone={ingredient.isGlobal ? "info" : "neutral"}>{ingredient.isGlobal ? "Global" : "Org-specific"}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Recipe uses</dt>
                <dd className="font-medium">{ingredient._count.recipeIngredients}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">
              Aliases ({ingredient.aliases.length})
            </h2>
            <div className="mt-4 space-y-2">
              {ingredient.aliases.map((alias) => (
                <div key={alias.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium">{alias.alias}</span>
                  <div className="flex gap-2 text-xs text-[var(--color-muted)]">
                    {alias.language && <span>{alias.language}</span>}
                    {alias.countryCode && <span>{alias.countryCode}</span>}
                    <span>confidence {(alias.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
              {ingredient.aliases.length === 0 && (
                <p className="text-sm text-[var(--color-muted)]">No aliases defined.</p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Unit conversions</h2>
          {ingredient.unitConversions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              No ingredient-specific conversions. Standard unit conversions apply.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)]">
              <div className="grid grid-cols-4 border-b border-[var(--color-border)] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                <span>From</span>
                <span>To</span>
                <span>Multiplier</span>
                <span>Confidence</span>
              </div>
              {ingredient.unitConversions.map((conv) => (
                <div key={conv.id} className="grid grid-cols-4 border-t border-[var(--color-border)] px-4 py-3 text-sm">
                  <span className="font-medium">{conv.fromUnit.name}</span>
                  <span className="font-medium">{conv.toUnit.name}</span>
                  <span className="font-mono">{conv.multiplier}</span>
                  <span className="text-[var(--color-muted)]">{(conv.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
          {ingredient.unitConversions.some(c => c.notes) && (
            <div className="mt-4 space-y-1">
              {ingredient.unitConversions.filter(c => c.notes).map(c => (
                <p key={c.id} className="text-xs text-[var(--color-muted)]">
                  {c.fromUnit.name} → {c.toUnit.name}: {c.notes}
                </p>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
