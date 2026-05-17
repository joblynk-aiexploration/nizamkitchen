import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { listCuisines } from "@/server/cuisines";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  await requireMembership();

  const cuisines = await listCuisines();

  async function createRecipe(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { createRecipe: create } = await import("@/server/recipes");
      const { slugify } = await import("@/lib/slug");

      const sess = await getSession();
      const name = formData.get("name") as string;
      const recipe = await create(sess, {
        name,
        slug: slugify(name),
        cuisineId: formData.get("cuisineId") as string,
        description: (formData.get("description") as string) || null,
        difficulty: formData.get("difficulty") as never,
        spiceLevel: formData.get("spiceLevel") as never,
        prepMinutes: Number(formData.get("prepMinutes")),
        cookMinutes: Number(formData.get("cookMinutes")),
        servings: Number(formData.get("servings")),
        visibility: (formData.get("visibility") as never) || "organization",
        sourceType: "user_created",
        organizationId: sess.activeOrganization.id,
        isGlobal: false,
        isPublished: false,
      });

      redirect(`/recipes/${recipe.id}/edit`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create recipe."))}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recipe library"
        title="New recipe"
        description="Create a recipe. Ingredients and steps can be added after saving."
      />

      <Card>
        <form action={createRecipe} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="name">
                Recipe name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                placeholder="e.g. Hyderabadi Chicken Biryani"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="cuisineId">
                Cuisine
              </label>
              <select
                id="cuisineId"
                name="cuisineId"
                required
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              >
                {cuisines.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="visibility">
                Visibility
              </label>
              <select
                id="visibility"
                name="visibility"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="organization">Organization only</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="difficulty">
                Difficulty
              </label>
              <select
                id="difficulty"
                name="difficulty"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="spiceLevel">
                Spice level
              </label>
              <select
                id="spiceLevel"
                name="spiceLevel"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="mild">Mild</option>
                <option value="medium">Medium</option>
                <option value="hot">Hot</option>
                <option value="extra_hot">Extra Hot</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="prepMinutes">
                Prep time (minutes)
              </label>
              <input
                id="prepMinutes"
                name="prepMinutes"
                type="number"
                min="0"
                defaultValue="15"
                required
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="cookMinutes">
                Cook time (minutes)
              </label>
              <input
                id="cookMinutes"
                name="cookMinutes"
                type="number"
                min="0"
                defaultValue="30"
                required
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="servings">
                Servings
              </label>
              <input
                id="servings"
                name="servings"
                type="number"
                min="1"
                defaultValue="4"
                required
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                placeholder="Short description of the recipe..."
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white"
          >
            Create recipe
          </button>
        </form>
      </Card>
    </div>
  );
}
