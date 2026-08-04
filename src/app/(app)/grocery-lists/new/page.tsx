import { redirect } from "next/navigation";
import { GroceryListRecipeServings } from "@/components/grocery/grocery-list-recipe-servings";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { hasPlatformRole, PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { listRecipes } from "@/server/recipes";

export const dynamic = "force-dynamic";

export default async function NewGroceryListPage() {
  const session = await requireMembership();
  const orgId = session.activeOrganization.id;

  const featureEnabled = await isFeatureEnabled("grocery_engine", orgId);
  if (!featureEnabled && !hasPlatformRole(session.user.platformRole, PLATFORM_ADMIN_ROLES)) {
    redirect("/grocery-lists");
  }

  const recipes = await listRecipes({
    organizationId: orgId,
    publishedOnly: true,
  });

  async function createGroceryList(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { generateGroceryList } = await import("@/server/grocery");
      const { groceryListCreateSchema } = await import("@/lib/validation/grocery");

      const sess = await getSession();
      const orgId = sess.activeOrganization.id;

      const name = formData.get("name") as string;
      const notes = (formData.get("notes") as string) || undefined;
      const householdSize = formData.get("householdSize") ? Number(formData.get("householdSize")) : undefined;

      const recipeEntries: Array<{ recipeId: string; targetServings: number }> = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("recipe_") && key.endsWith("_servings") && value) {
          const recipeId = key.replace("recipe_", "").replace("_servings", "");
          recipeEntries.push({ recipeId, targetServings: Number(value) });
        }
      }

      const parsed = groceryListCreateSchema.safeParse({
        name,
        recipes: recipeEntries,
        notes,
        householdSize,
      });

      if (!parsed.success) {
        redirect("/grocery-lists/new?message=Enter a list name and at least one recipe.");
      }

      const list = await generateGroceryList({
        organizationId: orgId,
        countryCode: sess.activeOrganization.countryCode,
        createdById: sess.user.id,
        input: parsed.data,
      });

      redirect(`/grocery-lists/${list.id}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/grocery-lists/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to generate grocery list."))}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Grocery Engine"
        title="New grocery list"
        description="Select recipes and set target servings. The engine will merge and convert all ingredients automatically."
      />

      <Card>
        <form action={createGroceryList} className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">List details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="name">
                  List name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder="e.g. Weekly meal prep — 6 people"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="householdSize">
                  Household size (optional)
                </label>
                <input
                  id="householdSize"
                  name="householdSize"
                  type="number"
                  min="1"
                  max="100"
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder="4"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="notes">
                  Notes (optional)
                </label>
                <input
                  id="notes"
                  name="notes"
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder="Any special notes..."
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">
              Select recipes and target servings
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Enter a serving count for each recipe you want to include. Leave blank to exclude.
            </p>

            {recipes.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No published recipes available. Publish some recipes first.
              </p>
            ) : (
              <GroceryListRecipeServings
                recipes={recipes.map((recipe) => ({
                  id: recipe.id,
                  name: recipe.name,
                  cuisineName: recipe.cuisine.name,
                  defaultServings: recipe.servings,
                  servingUnit: recipe.servingUnit,
                }))}
              />
            )}
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white"
          >
            Generate grocery list
          </button>
        </form>
      </Card>
    </div>
  );
}
