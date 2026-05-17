import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDangerZone } from "@/components/admin/admin-danger-zone";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { getRecipeById } from "@/server/recipes";
import { formatTotalTime, groupIngredientsBySection } from "@/lib/recipe-utils";

export const dynamic = "force-dynamic";

export default async function AdminRecipeDetailPage({
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
  const recipe = await getRecipeById(id);

  if (!recipe) notFound();

  const canMutate =
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin";

  const sections = groupIngredientsBySection(recipe.ingredients);

  async function togglePublished() {
    "use server";
    try {
      const { requirePlatformRole: getSession } = await import("@/lib/auth/session");
      const { updateRecipe } = await import("@/server/recipes");
      const { revalidatePath } = await import("next/cache");
      const sess = await getSession(["platform_owner", "platform_admin"]);
      const current = await (await import("@/server/recipes")).getRecipeById(id);
      if (!current) {
        redirect("/admin/recipe-library?message=Recipe not found.");
      }
      await updateRecipe(sess, id, { isPublished: !current.isPublished });
      revalidatePath(`/admin/recipe-library/${id}`);
      revalidatePath("/admin/recipe-library");
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/admin/recipe-library/${id}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update recipe publication."))}`);
    }
  }

  return (
    <AdminShell
      session={session}
      title={recipe.name}
      description={`${recipe.cuisine.name} · ${formatTotalTime(recipe)} · ${recipe.servings} servings`}
    >
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{recipe.difficulty}</Badge>
        <Badge tone="warning">{recipe.spiceLevel}</Badge>
        <Badge tone={recipe.isPublished ? "success" : "neutral"}>
          {recipe.isPublished ? "Published" : "Draft"}
        </Badge>
        {recipe.isGlobal && <Badge tone="info">global</Badge>}
        {recipe.visibility !== "global" && <Badge tone="warning">{recipe.visibility}</Badge>}
        {recipe.countryCode && <Badge tone="neutral">{recipe.countryCode}</Badge>}
        {recipe.dietaryTags.map(({ dietaryTag }) => (
          <Badge key={dietaryTag.id} tone="success">{dietaryTag.name}</Badge>
        ))}
      </div>

      {recipe.description && (
        <Card>
          <p className="text-sm text-[var(--color-ink)]">{recipe.description}</p>
          {recipe.story && (
            <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-xs italic text-[var(--color-muted)]">
              {recipe.story}
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">
            Ingredients ({recipe.ingredients.length})
          </h2>
          {Array.from(sections.entries()).map(([section, items]) => (
            <div key={section} className="mt-4">
              {sections.size > 1 && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {section}
                </p>
              )}
              <ul className="space-y-1">
                {items.map((ri) => (
                  <li key={ri.id} className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm odd:bg-slate-50">
                    <span className="font-mono text-xs font-medium text-slate-500">
                      {ri.quantity}{ri.unit.symbol ?? ri.unit.code}
                    </span>
                    <span>
                      <Link href={`/admin/ingredients/${ri.ingredientId}`} className="hover:text-[var(--color-primary)]">
                        {ri.ingredient.name}
                      </Link>
                      {ri.preparationNote && (
                        <span className="italic text-[var(--color-muted)]">, {ri.preparationNote}</span>
                      )}
                      {ri.isOptional && <span className="ml-1 text-xs text-slate-400">(optional)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>

        <div className="space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Steps</h2>
          {recipe.steps.map((step) => (
            <Card key={step.id}>
              <div className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                  {step.stepNumber}
                </div>
                <div>
                  {step.title && <p className="font-semibold text-[var(--color-ink)]">{step.title}</p>}
                  <p className="mt-1 text-sm text-[var(--color-ink)]">{step.instruction}</p>
                  {step.durationMinutes && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">~{step.durationMinutes} min</p>
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

      {canMutate && (
        <AdminDangerZone
          title="Publication control"
          description={
            recipe.isPublished
              ? "This recipe is currently published and visible to all organizations."
              : "This recipe is a draft and not visible to users."
          }
        >
          <form action={togglePublished}>
            <button
              type="submit"
              className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white ${
                recipe.isPublished
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {recipe.isPublished ? "Unpublish recipe" : "Publish recipe"}
            </button>
          </form>
        </AdminDangerZone>
      )}
    </AdminShell>
  );
}
