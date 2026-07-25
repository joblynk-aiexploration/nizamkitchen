import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { getRecipeById } from "@/server/recipes";
import { listIngredients } from "@/server/ingredients";
import { listUnits } from "@/server/units";
import { listCuisines } from "@/server/cuisines";
import { FULL_PLATFORM_ADMIN_ROLES, hasPlatformRole } from "@/lib/auth";
import { VideoReferenceCard } from "@/components/video/video-reference-card";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { RecipeIngredientsEditor } from "@/components/recipes/recipe-ingredients-editor";
import { RecipeStepsEditor } from "@/components/recipes/recipe-steps-editor";
import { ServingUnitSelect } from "@/components/recipes/serving-unit-select";
import { RecipeEditSection } from "@/components/recipes/recipe-edit-section";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const { message } = await searchParams;
  const recipe = await getRecipeById(id);

  if (!recipe) notFound();

  const isAdmin = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  if ((recipe.isGlobal || recipe.visibility === "global" || !recipe.organizationId) && !isAdmin) {
    if (!recipe.isPublished) notFound();
    const { copyRecipeToMyRecipes } = await import("@/server/recipes");
    const copy = await copyRecipeToMyRecipes({
      session,
      recipeId: recipe.id,
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
    });
    redirect(`/recipes/${copy.id}/edit?message=${encodeURIComponent("You are editing your My Recipes copy. The global recipe stays unchanged.")}`);
  }

  const canEdit = isAdmin || recipe.organizationId === session.activeOrganization.id;

  if (!canEdit) notFound();

  const isMyRecipe = !isAdmin && recipe.organizationId === session.activeOrganization.id;

  const [ingredients, units, cuisines] = await Promise.all([
    listIngredients({ organizationId: session.activeOrganization.id }),
    listUnits(),
    listCuisines(),
  ]);

  async function updateBasics(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { updateRecipe } = await import("@/server/recipes");
      const sess = await getSession();
      const updated = await updateRecipe(sess, id, {
        name: formData.get("name") as string,
        cuisineId: formData.get("cuisineId") as string,
        story: (formData.get("story") as string) || null,
        difficulty: formData.get("difficulty") as never,
        spiceLevel: formData.get("spiceLevel") as never,
        prepMinutes: Number(formData.get("prepMinutes")),
        cookMinutes: Number(formData.get("cookMinutes")),
        restMinutes: formData.get("restMinutes") ? Number(formData.get("restMinutes")) : null,
        servings: Number(formData.get("servings")),
        servingUnit: (formData.get("servingUnit") as string) || "serving",
        visibility: (formData.get("visibility") as never) || recipe!.visibility,
      });
      redirect(`/recipes/${updated.id}/edit?message=${encodeURIComponent("Recipe details saved to your My Recipes copy.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save recipe details."))}`);
    }
  }

  async function addIngredients(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { addRecipeIngredient } = await import("@/server/recipes");
      const sess = await getSession();
      const ingredientIds = formData.getAll("ingredientId").map((value) => String(value));
      const quantities = formData.getAll("quantity").map((value) => String(value));
      const unitIds = formData.getAll("unitId").map((value) => String(value));
      const preparationNotes = formData.getAll("preparationNote").map((value) => String(value));
      const sections = formData.getAll("section").map((value) => String(value));
      let added = 0;

      for (let index = 0; index < ingredientIds.length; index += 1) {
        const ingredientId = ingredientIds[index]?.trim();
        const unitId = unitIds[index]?.trim();
        const quantity = Number(quantities[index]);
        const hasAnyValue = Boolean(ingredientId || unitId || quantities[index]?.trim() || preparationNotes[index]?.trim() || sections[index]?.trim());
        if (!hasAnyValue) continue;
        if (!ingredientId) throw new Error("Choose every ingredient from the approved ingredient dropdown.");
        if (!unitId) throw new Error("Choose a unit for every ingredient.");
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Enter a quantity greater than zero for every ingredient.");
        await addRecipeIngredient(sess, {
          recipeId: id,
          ingredientId,
          quantity,
          unitId,
          preparationNote: preparationNotes[index]?.trim() || null,
          section: sections[index]?.trim() || null,
          isOptional: formData.get(`isOptional:${index}`) === "on",
          displayOrder: recipe!.ingredients.length + added,
        });
        added += 1;
      }

      if (!added) throw new Error("Choose at least one approved ingredient to add.");
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(`${added} ingredient${added === 1 ? "" : "s"} added.`)}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add ingredients."))}`);
    }
  }

  async function updateIngredient(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { updateRecipeIngredient } = await import("@/server/recipes");
      const sess = await getSession();
      const quantity = Number(formData.get("quantity"));
      await updateRecipeIngredient(sess, {
        recipeId: id,
        recipeIngredientId: String(formData.get("recipeIngredientId") ?? ""),
        ingredientId: String(formData.get("ingredientId") ?? ""),
        quantity,
        unitId: String(formData.get("unitId") ?? ""),
        preparationNote: String(formData.get("preparationNote") ?? "").trim() || null,
        section: String(formData.get("section") ?? "").trim() || null,
        isOptional: formData.get("isOptional") === "on",
      });
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Ingredient saved.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save ingredient."))}`);
    }
  }

  async function deleteIngredient(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { deleteRecipeIngredient } = await import("@/server/recipes");
      const sess = await getSession();
      await deleteRecipeIngredient(sess, {
        recipeId: id,
        recipeIngredientId: String(formData.get("recipeIngredientId") ?? ""),
      });
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Ingredient removed.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove ingredient."))}`);
    }
  }

  async function moveIngredient(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { moveRecipeIngredient } = await import("@/server/recipes");
      const sess = await getSession();
      const direction = String(formData.get("direction"));
      if (direction !== "up" && direction !== "down") throw new Error("Choose a valid move direction.");
      await moveRecipeIngredient(sess, {
        recipeId: id,
        recipeIngredientId: String(formData.get("recipeIngredientId") ?? ""),
        direction,
      });
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Ingredient order updated.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to reorder ingredient."))}`);
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
        temperature: (formData.get("temperature") as string) || null,
        tips: (formData.get("tips") as string) || null,
      });
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Step added.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add step."))}`);
    }
  }

  async function updateStep(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { updateRecipeStep } = await import("@/server/recipes");
      const sess = await getSession();
      await updateRecipeStep(sess, {
        recipeId: id,
        stepId: String(formData.get("stepId") ?? ""),
        title: (formData.get("title") as string) || null,
        instruction: formData.get("instruction") as string,
        durationMinutes: formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : null,
        temperature: (formData.get("temperature") as string) || null,
        tips: (formData.get("tips") as string) || null,
      });
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Step saved.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save step."))}`);
    }
  }

  async function deleteStep(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { deleteRecipeStep } = await import("@/server/recipes");
      const sess = await getSession();
      await deleteRecipeStep(sess, {
        recipeId: id,
        stepId: String(formData.get("stepId") ?? ""),
      });
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Step removed.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove step."))}`);
    }
  }

  async function moveStep(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { moveRecipeStep } = await import("@/server/recipes");
      const sess = await getSession();
      const direction = String(formData.get("direction"));
      if (direction !== "up" && direction !== "down") throw new Error("Choose a valid move direction.");
      await moveRecipeStep(sess, {
        recipeId: id,
        stepId: String(formData.get("stepId") ?? ""),
        direction,
      });
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Step order updated.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to reorder step."))}`);
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
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent("Ingredient request sent to the platform team.")}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/recipes/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to request ingredient."))}`);
    }
  }

  const youtubeRefs = recipe.mediaRefs
    .filter((r) => r.type === "youtube")
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isMyRecipe ? "My Recipes" : recipe.cuisine.name}
        title={isMyRecipe ? `Edit My Recipe: ${recipe.name}` : `Edit: ${recipe.name}`}
        description={
          isMyRecipe
            ? "This is your household copy. Changes stay in My Recipes and do not update the global recipe library."
            : "Add ingredients, steps, and video references to this recipe."
        }
        actions={
          isMyRecipe ? (
            <Button asChild variant="secondary">
              <Link href="/recipes/my">Back to My Recipes</Link>
            </Button>
          ) : undefined
        }
      />

      {message && <FormMessage message={message} />}

      <RecipeEditSection
        eyebrow="Recipe details"
        title="Basics and visibility"
        description="Edit the recipe name, cuisine, servings, timing, and household notes."
        meta={recipe.sourceRecipeId ? "Customized copy" : recipe.visibility}
      >
        <Card>
          <form action={updateBasics} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[var(--color-ink)]">Recipe details</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  These details belong to this household or workspace copy only.
                </p>
              </div>
              {recipe.sourceRecipeId && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
                  Customized from global recipe
                </span>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="name">
                  Recipe name
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={recipe.name}
                  required
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="cuisineId">
                  Cuisine
                </label>
                <select
                  id="cuisineId"
                  name="cuisineId"
                  defaultValue={recipe.cuisineId}
                  required
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
                >
                  {cuisines.map((cuisine) => (
                    <option key={cuisine.id} value={cuisine.id}>{cuisine.name}</option>
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
                  defaultValue={recipe.visibility}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
                >
                  <option value="private">Private</option>
                  <option value="organization">Household/workspace</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="difficulty">
                  Difficulty
                </label>
                <select
                  id="difficulty"
                  name="difficulty"
                  defaultValue={recipe.difficulty}
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
                  defaultValue={recipe.spiceLevel}
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
                  Prep time
                </label>
                <input id="prepMinutes" name="prepMinutes" type="number" min="0" defaultValue={recipe.prepMinutes} required className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="cookMinutes">
                  Cook time
                </label>
                <input id="cookMinutes" name="cookMinutes" type="number" min="0" defaultValue={recipe.cookMinutes} required className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="restMinutes">
                  Rest time
                </label>
                <input id="restMinutes" name="restMinutes" type="number" min="0" defaultValue={recipe.restMinutes ?? 0} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="servings">
                  Servings
                </label>
                <input id="servings" name="servings" type="number" min="1" defaultValue={recipe.servings} required className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="servingUnit">
                  Serving unit
                </label>
                <ServingUnitSelect defaultValue={recipe.servingUnit} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="story">
                  Family notes
                </label>
                <textarea id="story" name="story" rows={4} defaultValue={recipe.story ?? ""} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              </div>
            </div>
            <Button type="submit">Save recipe details</Button>
          </form>
        </Card>
      </RecipeEditSection>

      <RecipeEditSection
        eyebrow="Ingredients"
        title="Ingredient builder"
        description="Open when you need to add, reorder, or edit grocery-ready ingredients."
        meta={`${recipe.ingredients.length} ingredients`}
      >
        <RecipeIngredientsEditor
          recipeIngredients={recipe.ingredients}
          ingredients={ingredients}
          units={units}
          addIngredientsAction={addIngredients}
          updateIngredientAction={updateIngredient}
          deleteIngredientAction={deleteIngredient}
          moveIngredientAction={moveIngredient}
          requestIngredientAction={requestIngredient}
        />
      </RecipeEditSection>

      <RecipeEditSection
        eyebrow="Cooking steps"
        title="Step builder"
        description="Open when you need to add, reorder, or edit cooking instructions."
        meta={`${recipe.steps.length} steps`}
      >
        <RecipeStepsEditor
          steps={recipe.steps}
          addStepAction={addStep}
          updateStepAction={updateStep}
          deleteStepAction={deleteStep}
          moveStepAction={moveStep}
        />
      </RecipeEditSection>

      <RecipeEditSection
        eyebrow="Videos"
        title="Verified video references"
        description="Open when you need to add or remove YouTube references for this recipe."
        meta={`${youtubeRefs.length} videos`}
      >
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-[var(--color-ink)]">
              Video references ({youtubeRefs.length})
            </h2>
            <Button asChild variant="secondary">
              <a href="#add-video-ref">Add video</a>
            </Button>
          </div>

          {youtubeRefs.length > 0 && (
            <div className="mt-4 space-y-3">
              {youtubeRefs.map((ref) => (
                <div key={ref.id} className="space-y-2">
                  <VideoReferenceCard ref_={ref} showEmbed={false} />
                  <form action={`/api/recipes/${recipe.id}/media-references/${ref.id}`} method="post" className="flex gap-2">
                    <input type="hidden" name="_method" value="DELETE" />
                    <button
                      type="submit"
                      className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <div id="add-video-ref" className="mt-6 border-t border-[var(--color-border)] pt-6">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-ink)]">Add YouTube video</h3>
            <form
              action={`/api/recipes/${recipe.id}/media-references`}
              method="post"
              className="grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="type" value="youtube" />
              <input type="hidden" name="provider" value="youtube" />
              <div className="sm:col-span-2">
                <input
                  name="url"
                  placeholder="YouTube URL"
                  required
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>
              <input name="title" placeholder="Video title" required className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <input name="creatorName" placeholder="Creator / Channel" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                <input type="checkbox" name="isPrimary" />
                <span>Set as primary</span>
              </label>
              <Button type="submit" variant="primary">Add video</Button>
            </form>
          </div>
        </Card>
      </RecipeEditSection>
    </div>
  );
}
