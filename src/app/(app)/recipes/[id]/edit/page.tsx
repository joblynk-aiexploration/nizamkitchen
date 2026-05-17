import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { getRecipeById } from "@/server/recipes";
import { listIngredients } from "@/server/ingredients";
import { listUnits } from "@/server/units";
import { FULL_PLATFORM_ADMIN_ROLES, hasPlatformRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const recipe = await getRecipeById(id);

  if (!recipe) notFound();

  const canEdit = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES) ||
    recipe.organizationId === session.activeOrganization.id;

  if (!canEdit) notFound();

  const [ingredients, units] = await Promise.all([
    listIngredients({ isGlobal: true }),
    listUnits(),
  ]);

  async function addIngredient(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { addRecipeIngredient } = await import("@/server/recipes");
      const sess = await getSession();
      await addRecipeIngredient(sess, {
        recipeId: id,
        ingredientId: formData.get("ingredientId") as string,
        quantity: Number(formData.get("quantity")),
        unitId: formData.get("unitId") as string,
        preparationNote: (formData.get("preparationNote") as string) || null,
        section: (formData.get("section") as string) || null,
        isOptional: formData.get("isOptional") === "on",
        displayOrder: recipe!.ingredients.length,
      });
      redirect(`/recipes/${id}/edit`);
    } catch (error) {
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getErrorMessage(error, "Unable to add ingredient."))}`);
    }
  }

  async function addStep(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { addRecipeStep } = await import("@/server/recipes");
      const sess = await getSession();
      await addRecipeStep(sess, {
        recipeId: id,
        stepNumber: recipe!.steps.length + 1,
        title: (formData.get("title") as string) || null,
        instruction: formData.get("instruction") as string,
        durationMinutes: formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : null,
        tips: (formData.get("tips") as string) || null,
      });
      redirect(`/recipes/${id}/edit`);
    } catch (error) {
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getErrorMessage(error, "Unable to add step."))}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={recipe.cuisine.name}
        title={`Edit: ${recipe.name}`}
        description="Add ingredients and steps to this recipe."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">
            Ingredients ({recipe.ingredients.length})
          </h2>
          <div className="mt-4 space-y-2">
            {recipe.ingredients.map((ri) => (
              <div key={ri.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium">{ri.quantity} {ri.unit.code}</span>
                <span className="text-[var(--color-ink)]">{ri.ingredient.name}</span>
                {ri.preparationNote && (
                  <span className="italic text-[var(--color-muted)]">{ri.preparationNote}</span>
                )}
                {ri.section && <span className="text-xs text-slate-400">({ri.section})</span>}
              </div>
            ))}
          </div>

          <form action={addIngredient} className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Add ingredient</p>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                name="ingredientId"
                required
                className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Select ingredient</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  name="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Qty"
                  className="w-24 rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
                />
                <select
                  name="unitId"
                  required
                  className="flex-1 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                >
                  <option value="">Unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <input
                name="preparationNote"
                type="text"
                placeholder="Preparation note (optional)"
                className="rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
              />
              <input
                name="section"
                type="text"
                placeholder="Section e.g. Marinade (optional)"
                className="rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isOptional" />
              Optional ingredient
            </label>
            <button
              type="submit"
              className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Add ingredient
            </button>
          </form>
        </Card>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">
            Steps ({recipe.steps.length})
          </h2>
          <div className="mt-4 space-y-3">
            {recipe.steps.map((step) => (
              <div key={step.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                  {step.stepNumber}
                </span>
                <div>
                  {step.title && <p className="text-sm font-semibold">{step.title}</p>}
                  <p className="text-sm text-[var(--color-ink)]">{step.instruction}</p>
                  {step.durationMinutes && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{step.durationMinutes} min</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form action={addStep} className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Add step</p>
            <input
              name="title"
              type="text"
              placeholder="Step title (optional)"
              className="w-full rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
            />
            <textarea
              name="instruction"
              required
              rows={3}
              placeholder="Step instruction..."
              className="w-full rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
            />
            <div className="flex gap-3">
              <input
                name="durationMinutes"
                type="number"
                min="0"
                placeholder="Duration (min)"
                className="w-36 rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
              />
              <input
                name="tips"
                type="text"
                placeholder="Tip (optional)"
                className="flex-1 rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Add step
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
