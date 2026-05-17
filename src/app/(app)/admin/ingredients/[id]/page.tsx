import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { getIngredientById } from "@/server/ingredients";

export const dynamic = "force-dynamic";

export default async function AdminIngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);
  const { id } = await params;
  const ingredient = await getIngredientById(id);

  if (!ingredient) notFound();

  return (
    <AdminShell
      session={session}
      title={ingredient.canonicalName}
      description={`${ingredient.category} · ${ingredient.isGlobal ? "Global" : "Org-scoped"}`}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Canonical name</dt>
                <dd className="font-medium">{ingredient.canonicalName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Display name</dt>
                <dd className="font-medium">{ingredient.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Slug</dt>
                <dd className="font-mono text-xs">{ingredient.slug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Category</dt>
                <dd><Badge tone="neutral">{ingredient.category}</Badge></dd>
              </div>
              {ingredient.defaultUnit && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Default unit</dt>
                  <dd>{ingredient.defaultUnit.name} ({ingredient.defaultUnit.code})</dd>
                </div>
              )}
              {ingredient.averagePieceWeightGrams !== null && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Avg piece weight</dt>
                  <dd>{ingredient.averagePieceWeightGrams}g</dd>
                </div>
              )}
              {ingredient.densityGramPerMl !== null && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Density</dt>
                  <dd>{ingredient.densityGramPerMl} g/ml</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Active</dt>
                <dd><Badge tone={ingredient.isActive ? "success" : "danger"}>{ingredient.isActive ? "Yes" : "No"}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Recipe uses</dt>
                <dd>{ingredient._count.recipeIngredients}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="font-semibold">Aliases ({ingredient.aliases.length})</h2>
            <div className="mt-4 space-y-2">
              {ingredient.aliases.map((alias) => (
                <div key={alias.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium">{alias.alias}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {[alias.language, alias.countryCode, `${(alias.confidence * 100).toFixed(0)}% confidence`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              {ingredient.aliases.length === 0 && (
                <p className="text-sm text-[var(--color-muted)]">No aliases.</p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="font-semibold">Unit conversions ({ingredient.unitConversions.length})</h2>
          {ingredient.unitConversions.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              No ingredient-specific conversions defined. Standard unit conversions apply.
              Piece-to-gram conversion is {ingredient.averagePieceWeightGrams ? "available via average piece weight" : "not available"}.
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
                <div key={conv.id} className="grid grid-cols-4 items-start border-t border-[var(--color-border)] px-4 py-3 text-sm">
                  <span className="font-medium">{conv.fromUnit.name}</span>
                  <span className="font-medium">{conv.toUnit.name}</span>
                  <span className="font-mono">{conv.multiplier}</span>
                  <div>
                    <span>{(conv.confidence * 100).toFixed(0)}%</span>
                    {conv.notes && (
                      <p className="text-xs text-[var(--color-muted)]">{conv.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
