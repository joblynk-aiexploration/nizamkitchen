import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { listCuisines } from "@/server/cuisines";
import { listIngredients } from "@/server/ingredients";
import { listUnits } from "@/server/units";
import { Button } from "@/components/ui/button";
import { IngredientSelect, UnitSelect } from "@/components/recipes/ingredient-select";
import { IngredientSectionSelect } from "@/components/recipes/recipe-ingredients-editor";
import { ServingUnitSelect } from "@/components/recipes/serving-unit-select";

export const dynamic = "force-dynamic";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireMembership();
  const { message } = await searchParams;

  const [cuisines, ingredients, units] = await Promise.all([
    listCuisines(),
    listIngredients({ organizationId: session.activeOrganization.id }),
    listUnits(),
  ]);
  const isHousehold = session.activeOrganization.organizationType === "household";
  const sharedVisibilityLabel = isHousehold ? "My household" : "Workspace only";
  const sharedVisibilityHint = isHousehold
    ? "Visible to members of your household account."
    : "Visible to members of your current workspace.";

  async function createRecipe(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { createRecipe: create, addRecipeIngredient, addRecipeStep } = await import("@/server/recipes");
      const { createMediaReference } = await import("@/server/media-references");
      const { mediaReferenceCreateSchema } = await import("@/lib/validation/video");
      const { slugify } = await import("@/lib/slug");

      const sess = await getSession();
      const name = formData.get("name") as string;
      const recipe = await create(sess, {
        name,
        slug: slugify(name),
        cuisineId: formData.get("cuisineId") as string,
        description: (formData.get("description") as string) || null,
        story: (formData.get("story") as string) || null,
        difficulty: formData.get("difficulty") as never,
        spiceLevel: formData.get("spiceLevel") as never,
        prepMinutes: Number(formData.get("prepMinutes")),
        cookMinutes: Number(formData.get("cookMinutes")),
        restMinutes: formData.get("restMinutes") ? Number(formData.get("restMinutes")) : null,
        servings: Number(formData.get("servings")),
        servingUnit: (formData.get("servingUnit") as string) || "serving",
        visibility: (formData.get("visibility") as never) || "organization",
        sourceType: "user_created",
        organizationId: sess.activeOrganization.id,
        isGlobal: false,
        isUserCustomized: false,
        isPublished: true,
      });

      const setupMessages: string[] = [];
      try {
        const ingredientId = String(formData.get("ingredientId") ?? "").trim();
        const unitId = String(formData.get("unitId") ?? "").trim();
        const quantityValue = String(formData.get("quantity") ?? "").trim();
        const hasIngredientInput = Boolean(ingredientId || unitId || quantityValue);
        if (hasIngredientInput) {
          if (!ingredientId || !unitId || !quantityValue) {
            throw new Error("Choose an approved ingredient, quantity, and unit for the first ingredient.");
          }
          await addRecipeIngredient(sess, {
            recipeId: recipe.id,
            ingredientId,
            quantity: Number(quantityValue),
            unitId,
            preparationNote: (formData.get("preparationNote") as string) || null,
            section: (formData.get("section") as string) || null,
            isOptional: formData.get("isOptional") === "on",
            displayOrder: 0,
          });
          setupMessages.push("first ingredient added");
        }

        const instruction = String(formData.get("instruction") ?? "").trim();
        const hasStepInput = Boolean(instruction || String(formData.get("title") ?? "").trim() || String(formData.get("durationMinutes") ?? "").trim() || String(formData.get("tips") ?? "").trim());
        if (hasStepInput) {
          if (!instruction) {
            throw new Error("Enter an instruction before adding the first step.");
          }
          await addRecipeStep(sess, {
            recipeId: recipe.id,
            stepNumber: 1,
            title: (formData.get("title") as string) || null,
            instruction,
            durationMinutes: formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : null,
            tips: (formData.get("tips") as string) || null,
          });
          setupMessages.push("first step added");
        }

        const videoUrl = String(formData.get("videoUrl") ?? "").trim();
        const videoTitle = String(formData.get("videoTitle") ?? "").trim();
        const hasVideoInput = Boolean(videoUrl || videoTitle || String(formData.get("creatorName") ?? "").trim());
        if (hasVideoInput) {
          if (!videoUrl || !videoTitle) {
            throw new Error("Enter a YouTube URL and video title before adding the first video.");
          }
          const mediaInput = mediaReferenceCreateSchema.parse({
            type: "youtube",
            provider: "youtube",
            title: videoTitle,
            url: videoUrl,
            creatorName: formData.get("creatorName"),
            isPrimary: formData.get("isPrimary"),
            displayOrder: 0,
          });
          await createMediaReference({
            recipeId: recipe.id,
            input: mediaInput,
            actorUserId: sess.user.id,
            organizationId: recipe.organizationId,
            countryCode: recipe.countryCode,
          });
          setupMessages.push("video reference added");
        }
      } catch (setupError) {
        const setupMessage = getActionErrorMessage(setupError, "Recipe created, but one setup item could not be saved.");
        redirect(`/recipes/${recipe.id}/edit?message=${encodeURIComponent(`Recipe created. ${setupMessage}`)}`);
      }

      const suffix = setupMessages.length ? ` ${setupMessages.join(", ")}.` : "";
      redirect(`/recipes/${recipe.id}/edit?message=${encodeURIComponent(`Recipe created.${suffix}`)}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create recipe."))}`);
    }
  }

  async function requestIngredient(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { createIngredientRequest } = await import("@/server/recipes");
      const sess = await getSession();
      await createIngredientRequest({
        session: sess,
        organizationId: sess.activeOrganization.id,
        requestedName: formData.get("requestedName") as string,
        suggestedCategory: (formData.get("suggestedCategory") as string) || null,
        notes: (formData.get("notes") as string) || null,
      });
      redirect(`/recipes/new?message=${encodeURIComponent("Ingredient request sent to the platform team.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to request ingredient."))}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recipe library"
        title="New recipe"
        description="Create a household recipe with details, ingredients, cooking steps, and video references in one flow."
      />

      {message && <FormMessage message={message} />}

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
                Who can see this recipe?
              </label>
              <select
                id="visibility"
                name="visibility"
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="organization">{sharedVisibilityLabel}</option>
                <option value="private">Private</option>
              </select>
              <p className="mt-2 text-xs text-[var(--color-muted)]">{sharedVisibilityHint}</p>
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

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="servingUnit">
                Serving unit
              </label>
              <ServingUnitSelect defaultValue="serving" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="restMinutes">
                Rest time (minutes)
              </label>
              <input
                id="restMinutes"
                name="restMinutes"
                type="number"
                min="0"
                defaultValue="0"
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

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="story">
                Family notes
              </label>
              <textarea
                id="story"
                name="story"
                rows={4}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                placeholder="What makes this version work for your household?"
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-[var(--color-border)] p-5">
              <h2 className="font-semibold text-[var(--color-ink)]">Ingredients</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Add the first approved ingredient now. You can add more ingredients after the recipe is created.
              </p>

              <div className="mt-5 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <IngredientSelect ingredients={ingredients} required={false} />
                  <div className="flex gap-2">
                    <input
                      name="quantity"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Qty"
                      className="w-24 rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
                    />
                    <div className="flex-1">
                      <UnitSelect units={units} required={false} />
                    </div>
                  </div>
                  <input
                    name="preparationNote"
                    type="text"
                    placeholder="Preparation note (optional)"
                    className="rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
                  />
                  <IngredientSectionSelect />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isOptional" />
                  Optional ingredient
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--color-border)] p-5">
              <h2 className="font-semibold text-[var(--color-ink)]">Steps</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Add the first cooking step now. You can add more steps and reorder later from the edit page.
              </p>

              <div className="mt-5 space-y-3">
                <input
                  name="title"
                  type="text"
                  placeholder="Step title (optional)"
                  className="w-full rounded-2xl border border-[var(--color-border)] px-3 py-2 text-sm"
                />
                <textarea
                  name="instruction"
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
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--color-border)] p-5">
            <h2 className="font-semibold text-[var(--color-ink)]">Video references</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Add a YouTube cooking video now. Availability is checked when the YouTube integration is configured.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <input
                  name="videoUrl"
                  placeholder="YouTube URL"
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>
              <input
                name="videoTitle"
                placeholder="Video title"
                className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
              <input
                name="creatorName"
                placeholder="Creator / Channel"
                className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                <input type="checkbox" name="isPrimary" />
                <span>Set as primary</span>
              </label>
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

      <Card>
        <form action={requestIngredient} className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">Missing an ingredient?</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Send a request to add it to the canonical ingredient library before using it in recipes.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="requestedName"
              required
              placeholder="Ingredient name"
              className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <select
              name="suggestedCategory"
              className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            >
              <option value="">Suggested category</option>
              <option value="vegetable">Vegetable</option>
              <option value="fruit">Fruit</option>
              <option value="meat">Meat</option>
              <option value="poultry">Poultry</option>
              <option value="seafood">Seafood</option>
              <option value="dairy">Dairy</option>
              <option value="grain">Grain</option>
              <option value="lentil">Lentil</option>
              <option value="spice">Spice</option>
              <option value="herb">Herb</option>
              <option value="oil">Oil</option>
              <option value="condiment">Condiment</option>
              <option value="nut">Nut</option>
              <option value="sweetener">Sweetener</option>
              <option value="beverage">Beverage</option>
              <option value="packaged">Packaged</option>
              <option value="other">Other</option>
            </select>
            <textarea
              name="notes"
              rows={2}
              placeholder="Optional note for the platform team"
              className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm md:col-span-2"
            />
          </div>
          <Button type="submit" variant="secondary">Request ingredient</Button>
        </form>
      </Card>
    </div>
  );
}
