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
import { isFeatureEnabled } from "@/lib/feature-flags";
import { VideoReferenceCard } from "@/components/video/video-reference-card";
import { favoriteRecipeAction } from "@/app/(app)/household/actions";
import {
  canAccessFamilyProfiles,
  findAvoidedIngredientMatches,
  isFavoriteRecipe,
  listAvoidedIngredients,
} from "@/server/household";
import { canAccessHomeChefs, isHouseholdRequestOrganization } from "@/server/home-chef";

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

  const orgId = session.activeOrganization.id;
  const canEdit = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES) ||
    (recipe.organizationId === orgId);

  const [youtubeEnabled, restaurantFallbackEnabled] = await Promise.all([
    isFeatureEnabled("youtube_references", orgId),
    isFeatureEnabled("restaurant_fallback", orgId),
  ]);
  const familyProfilesEnabled = await canAccessFamilyProfiles({
    organizationId: orgId,
    platformRole: session.user.platformRole,
  });
  const homeChefsEnabled = await canAccessHomeChefs({
    organizationId: orgId,
    platformRole: session.user.platformRole,
  });

  const sections = groupIngredientsBySection(recipe.ingredients);

  const isAdmin = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  const allYoutubeRefs = recipe.mediaRefs
    .filter((r) => r.type === "youtube")
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.displayOrder - b.displayOrder);

  // Hide unavailable refs from non-admin users
  const youtubeRefs = isAdmin
    ? allYoutubeRefs
    : allYoutubeRefs.filter((r) => r.availabilityStatus !== "unavailable" && r.availabilityStatus !== "restricted");

  const otherRefs = recipe.mediaRefs.filter((r) => r.type !== "youtube");
  const primaryRef = youtubeRefs.find((r) => r.isPrimary) ?? youtubeRefs[0] ?? null;

  const showHouseholdTools = familyProfilesEnabled && session.activeOrganization.organizationType === "household";
  const showHomeChefRequest =
    homeChefsEnabled && isHouseholdRequestOrganization(session.activeOrganization.organizationType);
  const [favorite, avoidedIngredients] = showHouseholdTools
    ? await Promise.all([
        isFavoriteRecipe(orgId, recipe.id),
        listAvoidedIngredients(orgId),
      ])
    : [false, []];
  const avoidedMatches = findAvoidedIngredientMatches(recipe.ingredients, avoidedIngredients);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={recipe.cuisine.name}
        title={recipe.name}
        description={recipe.description ?? ""}
        actions={
          <Button asChild variant="secondary">
            <Link href={`/recipes/${recipe.id}/cooking`}>Cooking Mode</Link>
          </Button>
        }
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
        {showHouseholdTools && (
          <form action={favoriteRecipeAction} className={canEdit ? "" : "ml-auto"}>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <input type="hidden" name="favoriteAction" value={favorite ? "remove" : "add"} />
            <Button type="submit" variant={favorite ? "secondary" : "primary"}>
              {favorite ? "Favorited" : "Favorite"}
            </Button>
          </form>
        )}
        {showHomeChefRequest && (
          <Button asChild variant="secondary">
            <Link href={`/home-chef/request?type=recipe&recipeId=${recipe.id}`}>Request a chef for this recipe</Link>
          </Button>
        )}
        {restaurantFallbackEnabled && (
          <Button asChild variant="secondary">
            <Link href={`/order-instead/search?q=${encodeURIComponent(recipe.name)}&recipeId=${recipe.id}`}>
              Order Instead
            </Link>
          </Button>
        )}
      </div>

      {avoidedMatches.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">Household ingredient warning</p>
          <p className="mt-1 text-sm text-amber-800">
            This recipe includes an ingredient your household avoids:{" "}
            {[...new Set(avoidedMatches.map((item) => item.ingredientName))].join(", ")}.
          </p>
        </Card>
      )}

      {recipe.story && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">About this recipe</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">{recipe.story}</p>
        </Card>
      )}

      {/* Video section */}
      {youtubeEnabled && (
        <div className="space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Video</h2>
          {primaryRef ? (
            <VideoReferenceCard ref_={primaryRef} showEmbed />
          ) : (
            <Card>
              <p className="text-sm text-[var(--color-muted)]">No verified cooking video has been added yet.</p>
            </Card>
          )}
          {youtubeRefs.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--color-muted)]">More videos</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {youtubeRefs.filter((r) => r.id !== primaryRef?.id).map((ref) => (
                  <VideoReferenceCard key={ref.id} ref_={ref} showEmbed={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <Card className="touch-manipulation">
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
                    <li key={ri.id} className="flex min-h-12 items-start gap-3 rounded-xl bg-slate-50 px-3 py-3 text-base sm:text-sm">
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
            <Card key={step.id} className="touch-manipulation">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                  {step.stepNumber}
                </div>
                <div className="min-w-0 flex-1">
                  {step.title && (
                    <p className="font-semibold text-[var(--color-ink)]">{step.title}</p>
                  )}
                  <p className="mt-1 text-base leading-7 text-[var(--color-ink)] sm:text-sm sm:leading-6">{step.instruction}</p>
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

      {otherRefs.length > 0 && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">References</h2>
          <div className="mt-4 space-y-2">
            {otherRefs.map((ref) => (
              <a
                key={ref.id}
                href={ref.normalizedUrl ?? ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] p-3 text-sm hover:bg-slate-50"
              >
                <Badge tone="info">{ref.type}</Badge>
                <span className="font-medium text-[var(--color-primary)]">{ref.title}</span>
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
