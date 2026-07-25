import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { listCuisines } from "@/server/cuisines";

export const dynamic = "force-dynamic";

export default async function AdminNewRecipePage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const cuisines = await listCuisines();

  async function handleCreate(formData: FormData) {
    "use server";
    try {
      const { requirePlatformRole: getSession } = await import("@/lib/auth/session");
      const { createRecipe: create } = await import("@/server/recipes");
      const { slugify: toSlug } = await import("@/lib/slug");
      const sess = await getSession(["platform_owner", "platform_admin"]);
      const name = formData.get("name") as string;
      const recipe = await create(sess, {
        name,
        slug: toSlug(name),
        cuisineId: formData.get("cuisineId") as string,
        description: (formData.get("description") as string) || null,
        difficulty: formData.get("difficulty") as never,
        spiceLevel: formData.get("spiceLevel") as never,
        prepMinutes: Number(formData.get("prepMinutes")),
        cookMinutes: Number(formData.get("cookMinutes")),
        servings: Number(formData.get("servings")),
        visibility: "global",
        sourceType: "platform",
        isGlobal: true,
        isTemplate: true,
        isPublished: false,
      });
      redirect(`/admin/recipe-library/${recipe.id}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/admin/recipe-library/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create recipe."))}`);
    }
  }

  return (
    <AdminShell
      session={session}
      title="Create platform recipe"
      description="Create a global platform recipe. Ingredients and steps are added on the detail page."
    >
      <Card>
        <form action={handleCreate} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold" htmlFor="name">Recipe name</label>
              <input id="name" name="name" type="text" required
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                placeholder="e.g. Hyderabadi Chicken Biryani" />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="cuisineId">Cuisine</label>
              <select id="cuisineId" name="cuisineId" required
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                {cuisines.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="difficulty">Difficulty</label>
              <select id="difficulty" name="difficulty"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="spiceLevel">Spice level</label>
              <select id="spiceLevel" name="spiceLevel"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="mild">Mild</option>
                <option value="medium">Medium</option>
                <option value="hot">Hot</option>
                <option value="extra_hot">Extra Hot</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="prepMinutes">Prep time (min)</label>
              <input id="prepMinutes" name="prepMinutes" type="number" min="0" defaultValue="15"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="cookMinutes">Cook time (min)</label>
              <input id="cookMinutes" name="cookMinutes" type="number" min="0" defaultValue="30"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="servings">Servings</label>
              <input id="servings" name="servings" type="number" min="1" defaultValue="4"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold" htmlFor="description">Description</label>
              <textarea id="description" name="description" rows={3}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                placeholder="Short description..." />
            </div>
          </div>
          <button type="submit"
            className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">
            Create recipe
          </button>
        </form>
      </Card>
    </AdminShell>
  );
}
