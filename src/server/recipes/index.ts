import { prisma } from "@/lib/prisma";
import { paginatedQuery } from "@/lib/pagination";
import { slugify } from "@/lib/slug";
import type { SessionLike } from "@/lib/auth";
import { assertPlatformRole, assertMembershipAccess, FULL_PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { recordAdminAuditLog } from "@/server/audit/audit-service";
import { isRecipeVisibleToOrganization } from "@/lib/recipe-utils";
import { Prisma, type IngredientCategory, type RecipeDifficulty, type SpiceLevel, type RecipeVisibility, type RecipeSourceType } from "@prisma/client";

// Exclude recipes that were created as QA/test placeholders.
// These slugs and name patterns should never appear in production user-facing queries.
const QA_SLUG_PREFIXES = ["qa-", "test-", "admin-qa-"];
const QA_NAME_PREFIXES = ["QA ", "Test ", "Admin QA"];

function qaExcludeFilter() {
  return {
    NOT: [
      ...QA_SLUG_PREFIXES.map((p) => ({ slug: { startsWith: p } })),
      ...QA_NAME_PREFIXES.map((p) => ({ name: { startsWith: p } })),
    ],
  };
}

const RECIPE_INCLUDE = {
  cuisine: true,
  ingredients: {
    include: { ingredient: true, unit: true },
    orderBy: { displayOrder: "asc" as const },
  },
  steps: { orderBy: { displayOrder: "asc" as const } },
  mediaRefs: true,
  dietaryTags: { include: { dietaryTag: true } },
} as const;

type RecipeWriteAccess = {
  id: string;
  organizationId: string | null;
  isGlobal: boolean;
  visibility: RecipeVisibility;
};

async function assertRecipeWriteAccess(session: SessionLike, recipeId: string): Promise<RecipeWriteAccess> {
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    select: { id: true, organizationId: true, isGlobal: true, visibility: true },
  });
  const isGlobalRecipe = recipe.isGlobal || recipe.visibility === "global" || !recipe.organizationId;

  if (isGlobalRecipe) {
    assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  } else {
    const organizationId = recipe.organizationId;
    if (!organizationId) throw new Error("Recipe is missing its household or workspace owner.");
    assertMembershipAccess(session, organizationId);
  }

  return recipe;
}

async function assertApprovedRecipeIngredient(input: {
  ingredientId: string;
  unitId: string;
  organizationId?: string | null;
}) {
  const [ingredient, unit] = await Promise.all([
    prisma.ingredient.findFirst({
      where: {
        id: input.ingredientId,
        isActive: true,
        OR: [{ isGlobal: true }, ...(input.organizationId ? [{ organizationId: input.organizationId }] : [])],
      },
      select: { id: true },
    }),
    prisma.unit.findUnique({ where: { id: input.unitId }, select: { id: true } }),
  ]);

  if (!ingredient) throw new Error("Choose an ingredient from the approved ingredient list.");
  if (!unit) throw new Error("Choose a valid unit.");
}

export type RecipeListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  difficulty: RecipeDifficulty;
  spiceLevel: SpiceLevel;
  prepMinutes: number;
  cookMinutes: number;
  restMinutes: number | null;
  servings: number;
  servingUnit: string;
  visibility: RecipeVisibility;
  isGlobal: boolean;
  sourceRecipeId?: string | null;
  isUserCustomized?: boolean;
  isPublished: boolean;
  countryCode: string | null;
  organizationId: string | null;
  cuisine: { id: string; name: string; slug: string };
};

type RecipeListScope = "visible" | "global_templates";

type RecipeListParams = {
  organizationId?: string | null;
  countryCode?: string;
  cuisineId?: string;
  difficulty?: RecipeDifficulty;
  spiceLevel?: SpiceLevel;
  search?: string;
  publishedOnly?: boolean;
  scope?: RecipeListScope;
};

export async function listRecipes(params: RecipeListParams) {
  const { organizationId, countryCode, cuisineId, difficulty, spiceLevel, search, publishedOnly, scope } = params;

  const where = recipeListWhere({ organizationId, countryCode, cuisineId, difficulty, spiceLevel, search, publishedOnly, scope });

  return prisma.recipe.findMany({
    where,
    include: { cuisine: true },
    orderBy: { name: "asc" },
  });
}

export async function listGlobalRecipeTemplates(params: {
  countryCode?: string | null;
  search?: string;
  cuisineId?: string;
}) {
  return prisma.recipe.findMany({
    where: {
      ...qaExcludeFilter(),
      organizationId: null,
      visibility: "global",
      isPublished: true,
      ...(params.countryCode ? { OR: [{ countryCode: null }, { countryCode: params.countryCode }] } : {}),
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      ...(params.cuisineId ? { cuisineId: params.cuisineId } : {}),
    },
    include: { cuisine: true },
    orderBy: { name: "asc" },
  });
}

export async function listRecipesPage(params: RecipeListParams & {
  page?: string | string[] | number;
  pageSize?: string | string[] | number;
}) {
  const where = recipeListWhere(params);

  return paginatedQuery(
    prisma.recipe.count({ where }),
    ({ skip, take }) =>
      prisma.recipe.findMany({
        where,
        include: { cuisine: true },
        orderBy: { name: "asc" },
        skip,
        take,
      }),
    { page: params.page, pageSize: params.pageSize },
  );
}

function recipeListWhere(params: {
  organizationId?: string | null;
  countryCode?: string;
  cuisineId?: string;
  difficulty?: RecipeDifficulty;
  spiceLevel?: SpiceLevel;
  search?: string;
  publishedOnly?: boolean;
  scope?: RecipeListScope;
}): Prisma.RecipeWhereInput {
  const { organizationId, countryCode, cuisineId, difficulty, spiceLevel, search, publishedOnly, scope } = params;
  const andFilters: Prisma.RecipeWhereInput[] = [];

  if (countryCode) {
    andFilters.push({ OR: [{ countryCode: null }, { countryCode }] });
  }

  if (scope === "global_templates") {
    andFilters.push({
      organizationId: null,
      visibility: "global",
      isPublished: true,
    });
  } else if (organizationId) {
    andFilters.push({
      OR: [
        { visibility: "global", isPublished: true },
        { visibility: "organization", organizationId, isPublished: true },
        { visibility: "private", organizationId, isPublished: true },
      ],
    });
  }

  return {
    ...qaExcludeFilter(),
    ...(publishedOnly ? { isPublished: true } : {}),
    ...(cuisineId ? { cuisineId } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(spiceLevel ? { spiceLevel } : {}),
    ...(search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(andFilters.length ? { AND: andFilters } : {}),
  };
}

export async function getRecipeById(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: RECIPE_INCLUDE,
  });
}

export async function getRecipeWithSourceById(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: {
      ...RECIPE_INCLUDE,
      sourceRecipe: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getRecipeBySlug(slug: string, organizationId?: string | null) {
  const recipe = await prisma.recipe.findFirst({
    where: {
      OR: [
        { slug, organizationId: null },
        ...(organizationId ? [{ slug, organizationId }] : []),
      ],
    },
    include: RECIPE_INCLUDE,
  });

  if (!recipe) return null;

  // Enforce visibility rules
  if (organizationId && !isRecipeVisibleToOrganization(recipe, organizationId)) {
    return null;
  }

  return recipe;
}

export async function createRecipe(
  session: SessionLike,
  input: {
    name: string;
    slug?: string | null;
    cuisineId: string;
    description?: string | null;
    story?: string | null;
    difficulty: RecipeDifficulty;
    spiceLevel: SpiceLevel;
    prepMinutes: number;
    cookMinutes: number;
    restMinutes?: number | null;
    servings: number;
    servingUnit?: string;
    visibility?: RecipeVisibility;
    sourceType: RecipeSourceType;
    organizationId?: string | null;
    countryCode?: string | null;
    isGlobal?: boolean;
    sourceRecipeId?: string | null;
    isTemplate?: boolean;
    isUserCustomized?: boolean;
    isPublished?: boolean;
    dietaryTagIds?: string[];
  },
) {
  // Global recipes require platform admin; org recipes require membership
  if (input.isGlobal || !input.organizationId) {
    assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  } else {
    assertMembershipAccess(session, input.organizationId);
  }

  const slug = input.slug ?? slugify(input.name);

  const recipe = await prisma.recipe.create({
    data: {
      name: input.name,
      slug,
      cuisineId: input.cuisineId,
      description: input.description ?? null,
      story: input.story ?? null,
      difficulty: input.difficulty,
      spiceLevel: input.spiceLevel,
      prepMinutes: input.prepMinutes,
      cookMinutes: input.cookMinutes,
      restMinutes: input.restMinutes ?? null,
      servings: input.servings,
      servingUnit: input.servingUnit ?? "serving",
      visibility: input.visibility ?? "global",
      sourceType: input.sourceType,
      organizationId: input.organizationId ?? null,
      countryCode: input.countryCode ?? null,
      isGlobal: input.isGlobal ?? false,
      sourceRecipeId: input.sourceRecipeId ?? null,
      isTemplate: input.isTemplate ?? false,
      isUserCustomized: input.isUserCustomized ?? false,
      isPublished: input.isPublished ?? false,
      createdById: session.user.id,
      ...(input.dietaryTagIds?.length
        ? {
            dietaryTags: {
              create: input.dietaryTagIds.map((tagId) => ({ dietaryTagId: tagId })),
            },
          }
        : {}),
    },
    include: RECIPE_INCLUDE,
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: input.organizationId ?? null,
    action: "recipe.created",
    targetType: "recipe",
    targetId: recipe.id,
    details: { name: recipe.name, slug: recipe.slug, visibility: recipe.visibility },
  });

  return recipe;
}

export async function updateRecipe(
  session: SessionLike,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    story?: string | null;
    difficulty?: RecipeDifficulty;
    spiceLevel?: SpiceLevel;
    prepMinutes?: number;
    cookMinutes?: number;
    restMinutes?: number | null;
    servings?: number;
    servingUnit?: string;
    visibility?: RecipeVisibility;
    isPublished?: boolean;
    countryCode?: string | null;
    cuisineId?: string;
  },
) {
  const existing = await prisma.recipe.findUniqueOrThrow({ where: { id } });
  const isGlobalRecipe = existing.isGlobal || existing.visibility === "global" || !existing.organizationId;

  if (isGlobalRecipe) {
    assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  } else {
    const organizationId = existing.organizationId;
    if (!organizationId) {
      throw new Error("Recipe is missing its household or workspace owner.");
    }
    assertMembershipAccess(session, organizationId);
    if (input.visibility === "global") {
      throw new Error("Household recipe edits must stay in My Recipes. Global recipe changes are managed by the Platform Owner.");
    }
  }

  const recipe = await prisma.recipe.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name, slug: slugify(input.name) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.story !== undefined ? { story: input.story } : {}),
      ...(input.difficulty ? { difficulty: input.difficulty } : {}),
      ...(input.spiceLevel ? { spiceLevel: input.spiceLevel } : {}),
      ...(input.prepMinutes !== undefined ? { prepMinutes: input.prepMinutes } : {}),
      ...(input.cookMinutes !== undefined ? { cookMinutes: input.cookMinutes } : {}),
      ...(input.restMinutes !== undefined ? { restMinutes: input.restMinutes } : {}),
      ...(input.servings !== undefined ? { servings: input.servings } : {}),
      ...(input.servingUnit ? { servingUnit: input.servingUnit } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
      ...(input.cuisineId !== undefined ? { cuisineId: input.cuisineId } : {}),
    },
    include: RECIPE_INCLUDE,
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: existing.organizationId,
    action: "recipe.updated",
    targetType: "recipe",
    targetId: recipe.id,
    details: input,
  });

  return recipe;
}

export async function addRecipeIngredient(
  session: SessionLike,
  input: {
    recipeId: string;
    ingredientId: string;
    quantity: number;
    unitId: string;
    preparationNote?: string | null;
    section?: string | null;
    isOptional?: boolean;
    displayOrder?: number;
  },
) {
  const recipe = await assertRecipeWriteAccess(session, input.recipeId);
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Enter a quantity greater than zero.");
  }
  await assertApprovedRecipeIngredient({
    ingredientId: input.ingredientId,
    unitId: input.unitId,
    organizationId: recipe.organizationId,
  });

  return prisma.recipeIngredient.create({
    data: {
      recipeId: input.recipeId,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      unitId: input.unitId,
      preparationNote: input.preparationNote ?? null,
      section: input.section ?? null,
      isOptional: input.isOptional ?? false,
      displayOrder: input.displayOrder ?? 0,
    },
    include: { ingredient: true, unit: true },
  });
}

export async function updateRecipeIngredient(
  session: SessionLike,
  input: {
    recipeId: string;
    recipeIngredientId: string;
    ingredientId: string;
    quantity: number;
    unitId: string;
    preparationNote?: string | null;
    section?: string | null;
    isOptional?: boolean;
  },
) {
  const recipe = await assertRecipeWriteAccess(session, input.recipeId);
  const existing = await prisma.recipeIngredient.findFirst({
    where: { id: input.recipeIngredientId, recipeId: input.recipeId },
    select: { id: true },
  });
  if (!existing) throw new Error("Recipe ingredient not found.");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Enter a quantity greater than zero.");
  }
  await assertApprovedRecipeIngredient({
    ingredientId: input.ingredientId,
    unitId: input.unitId,
    organizationId: recipe.organizationId,
  });

  return prisma.recipeIngredient.update({
    where: { id: input.recipeIngredientId },
    data: {
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      unitId: input.unitId,
      preparationNote: input.preparationNote?.trim() || null,
      section: input.section?.trim() || null,
      isOptional: input.isOptional ?? false,
    },
    include: { ingredient: true, unit: true },
  });
}

export async function deleteRecipeIngredient(
  session: SessionLike,
  input: {
    recipeId: string;
    recipeIngredientId: string;
  },
) {
  await assertRecipeWriteAccess(session, input.recipeId);
  return prisma.recipeIngredient.deleteMany({
    where: { id: input.recipeIngredientId, recipeId: input.recipeId },
  });
}

export async function moveRecipeIngredient(
  session: SessionLike,
  input: {
    recipeId: string;
    recipeIngredientId: string;
    direction: "up" | "down";
  },
) {
  await assertRecipeWriteAccess(session, input.recipeId);
  const ingredients = await prisma.recipeIngredient.findMany({
    where: { recipeId: input.recipeId },
    select: { id: true, displayOrder: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  const currentIndex = ingredients.findIndex((ingredient) => ingredient.id === input.recipeIngredientId);
  if (currentIndex === -1) throw new Error("Recipe ingredient not found.");

  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= ingredients.length) return null;

  const current = ingredients[currentIndex];
  const target = ingredients[targetIndex];
  await prisma.$transaction([
    prisma.recipeIngredient.update({
      where: { id: current.id },
      data: { displayOrder: target.displayOrder },
    }),
    prisma.recipeIngredient.update({
      where: { id: target.id },
      data: { displayOrder: current.displayOrder },
    }),
  ]);

  return true;
}

export async function addRecipeStep(
  session: SessionLike,
  input: {
    recipeId: string;
    stepNumber: number;
    title?: string | null;
    instruction: string;
    durationMinutes?: number | null;
    temperature?: string | null;
    tips?: string | null;
    displayOrder?: number;
  },
) {
  await assertRecipeWriteAccess(session, input.recipeId);
  if (!input.instruction?.trim()) throw new Error("Enter a step instruction.");

  return prisma.recipeStep.create({
    data: {
      recipeId: input.recipeId,
      stepNumber: input.stepNumber,
      title: input.title ?? null,
      instruction: input.instruction,
      durationMinutes: input.durationMinutes ?? null,
      temperature: input.temperature ?? null,
      tips: input.tips ?? null,
      displayOrder: input.displayOrder ?? input.stepNumber - 1,
    },
  });
}

export async function updateRecipeStep(
  session: SessionLike,
  input: {
    recipeId: string;
    stepId: string;
    title?: string | null;
    instruction: string;
    durationMinutes?: number | null;
    temperature?: string | null;
    tips?: string | null;
  },
) {
  await assertRecipeWriteAccess(session, input.recipeId);
  const existing = await prisma.recipeStep.findFirst({
    where: { id: input.stepId, recipeId: input.recipeId },
    select: { id: true },
  });
  if (!existing) throw new Error("Recipe step not found.");
  if (!input.instruction?.trim()) throw new Error("Enter a step instruction.");

  return prisma.recipeStep.update({
    where: { id: input.stepId },
    data: {
      title: input.title?.trim() || null,
      instruction: input.instruction.trim(),
      durationMinutes: input.durationMinutes ?? null,
      temperature: input.temperature?.trim() || null,
      tips: input.tips?.trim() || null,
    },
  });
}

export async function deleteRecipeStep(
  session: SessionLike,
  input: {
    recipeId: string;
    stepId: string;
  },
) {
  await assertRecipeWriteAccess(session, input.recipeId);
  return prisma.recipeStep.deleteMany({
    where: { id: input.stepId, recipeId: input.recipeId },
  });
}

export async function moveRecipeStep(
  session: SessionLike,
  input: {
    recipeId: string;
    stepId: string;
    direction: "up" | "down";
  },
) {
  await assertRecipeWriteAccess(session, input.recipeId);
  const steps = await prisma.recipeStep.findMany({
    where: { recipeId: input.recipeId },
    select: { id: true, displayOrder: true },
    orderBy: [{ displayOrder: "asc" }, { stepNumber: "asc" }],
  });
  const currentIndex = steps.findIndex((step) => step.id === input.stepId);
  if (currentIndex === -1) throw new Error("Recipe step not found.");

  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= steps.length) return null;

  const current = steps[currentIndex];
  const target = steps[targetIndex];
  await prisma.$transaction([
    prisma.recipeStep.update({
      where: { id: current.id },
      data: { displayOrder: target.displayOrder },
    }),
    prisma.recipeStep.update({
      where: { id: target.id },
      data: { displayOrder: current.displayOrder },
    }),
  ]);

  return true;
}

export async function listAdminRecipes(params?: {
  search?: string;
  cuisineId?: string;
  isPublished?: boolean;
  countryCode?: string;
  includeQa?: boolean;
}) {
  return prisma.recipe.findMany({
    where: {
      ...(params?.includeQa ? {} : qaExcludeFilter()),
      ...(params?.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      ...(params?.cuisineId ? { cuisineId: params.cuisineId } : {}),
      ...(params?.isPublished !== undefined ? { isPublished: params.isPublished } : {}),
      ...(params?.countryCode ? { countryCode: params.countryCode } : {}),
    },
    include: {
      cuisine: true,
      _count: { select: { ingredients: true, steps: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function listMyRecipes(params: {
  organizationId: string;
  search?: string;
  cuisineId?: string;
  source?: "created" | "customized";
}) {
  return prisma.recipe.findMany({
    where: {
      ...qaExcludeFilter(),
      organizationId: params.organizationId,
      isPublished: true,
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      ...(params.cuisineId ? { cuisineId: params.cuisineId } : {}),
      ...(params.source === "created" ? { sourceRecipeId: null } : {}),
      ...(params.source === "customized" ? { sourceRecipeId: { not: null } } : {}),
    },
    include: {
      cuisine: true,
      sourceRecipe: { select: { id: true, name: true } },
      favoriteRecipes: {
        where: { organizationId: params.organizationId },
        select: { id: true },
        take: 1,
      },
      _count: { select: { ingredients: true, steps: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function findHouseholdRecipeCopy(params: {
  organizationId: string;
  sourceRecipeId: string;
}) {
  return prisma.recipe.findFirst({
    where: {
      organizationId: params.organizationId,
      sourceRecipeId: params.sourceRecipeId,
    },
    include: { cuisine: true },
  });
}

export async function copyRecipeToMyRecipes(params: {
  session: SessionLike;
  recipeId: string;
  organizationId: string;
  countryCode?: string | null;
}) {
  assertMembershipAccess(params.session, params.organizationId);
  const source = await prisma.recipe.findFirst({
    where: {
      id: params.recipeId,
      visibility: "global",
      isPublished: true,
    },
    include: RECIPE_INCLUDE,
  });
  if (!source) throw new Error("Global recipe is not available.");
  const existing = await findHouseholdRecipeCopy({
    organizationId: params.organizationId,
    sourceRecipeId: source.id,
  });
  if (existing) return existing;

  const copy = await prisma.recipe.create({
    data: {
      organizationId: params.organizationId,
      countryCode: params.countryCode ?? source.countryCode,
      sourceRecipeId: source.id,
      cuisineId: source.cuisineId,
      name: source.name,
      slug: await uniqueOrgRecipeSlug(params.organizationId, source.slug),
      description: source.description,
      story: source.story,
      difficulty: source.difficulty,
      spiceLevel: source.spiceLevel,
      prepMinutes: source.prepMinutes,
      cookMinutes: source.cookMinutes,
      restMinutes: source.restMinutes,
      servings: source.servings,
      servingUnit: source.servingUnit,
      visibility: "private",
      sourceType: "organization",
      createdById: params.session.user.id,
      isGlobal: false,
      isTemplate: false,
      isUserCustomized: true,
      isPublished: true,
      ingredients: {
        create: source.ingredients.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unitId: item.unitId,
          preparationNote: item.preparationNote,
          section: item.section,
          isOptional: item.isOptional,
          displayOrder: item.displayOrder,
        })),
      },
      steps: {
        create: source.steps.map((step) => ({
          stepNumber: step.stepNumber,
          title: step.title,
          instruction: step.instruction,
          durationMinutes: step.durationMinutes,
          temperature: step.temperature,
          tips: step.tips,
          displayOrder: step.displayOrder,
        })),
      },
      dietaryTags: {
        create: source.dietaryTags.map((tag) => ({ dietaryTagId: tag.dietaryTagId })),
      },
      mediaRefs: {
        create: source.mediaRefs.map((ref) => ({
          type: ref.type,
          provider: ref.provider,
          title: ref.title,
          url: ref.url,
          normalizedUrl: ref.normalizedUrl,
          embedUrl: ref.embedUrl,
          externalId: ref.externalId,
          thumbnailUrl: ref.thumbnailUrl,
          language: ref.language,
          creatorName: ref.creatorName,
          durationSeconds: ref.durationSeconds,
          isPrimary: ref.isPrimary,
          displayOrder: ref.displayOrder,
          notes: ref.notes,
          availabilityStatus: ref.availabilityStatus,
          lastAvailabilityCheckedAt: ref.lastAvailabilityCheckedAt,
          unavailableReason: ref.unavailableReason,
          isEmbeddable: ref.isEmbeddable,
          isPublic: ref.isPublic,
          uploadStatus: ref.uploadStatus,
        })),
      },
    },
    include: RECIPE_INCLUDE,
  });

  await recordAdminAuditLog({
    actorUserId: params.session.user.id,
    organizationId: params.organizationId,
    action: "recipe.copied_to_my_recipes",
    targetType: "recipe",
    targetId: copy.id,
    details: { sourceRecipeId: source.id, sourceRecipeName: source.name },
  });

  return copy;
}

async function uniqueOrgRecipeSlug(organizationId: string, sourceSlug: string) {
  let candidate = sourceSlug;
  let index = 2;
  while (await prisma.recipe.findUnique({ where: { slug_organizationId: { slug: candidate, organizationId } } })) {
    candidate = `${sourceSlug}-${index}`;
    index += 1;
  }
  return candidate;
}

export async function createIngredientRequest(params: {
  session: SessionLike;
  organizationId: string;
  requestedName: string;
  suggestedCategory?: string | null;
  notes?: string | null;
}) {
  assertMembershipAccess(params.session, params.organizationId);
  const requestedName = params.requestedName.trim();
  if (requestedName.length < 2) throw new Error("Enter the ingredient name you want added.");
  return prisma.ingredientRequest.create({
    data: {
      organizationId: params.organizationId,
      requestedById: params.session.user.id,
      requestedName,
      suggestedCategory: params.suggestedCategory ? (params.suggestedCategory as never) : null,
      notes: params.notes?.trim() || null,
    },
  });
}

export async function listIngredientRequests() {
  return prisma.ingredientRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function approveIngredientRequest(params: {
  session: SessionLike;
  requestId: string;
  category?: IngredientCategory | null;
}) {
  assertPlatformRole(params.session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  const request = await prisma.ingredientRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new Error("Ingredient request not found.");
  if (request.status !== "pending") throw new Error("Ingredient request has already been reviewed.");

  const category = params.category ?? request.suggestedCategory ?? "other";
  const ingredient = await prisma.ingredient.create({
    data: {
      name: request.requestedName,
      canonicalName: request.requestedName,
      slug: slugify(request.requestedName),
      category,
      isGlobal: true,
      isActive: true,
      organizationId: null,
      countryCode: null,
    },
  });

  await prisma.ingredientRequest.update({
    where: { id: request.id },
    data: {
      status: "approved",
      reviewedById: params.session.user.id,
      reviewedAt: new Date(),
      createdIngredientId: ingredient.id,
    },
  });

  await recordAdminAuditLog({
    actorUserId: params.session.user.id,
    organizationId: request.organizationId,
    action: "ingredient_request.approved",
    targetType: "ingredient_request",
    targetId: request.id,
    details: { requestedName: request.requestedName, ingredientId: ingredient.id, category },
  });

  return ingredient;
}

export async function rejectIngredientRequest(params: {
  session: SessionLike;
  requestId: string;
}) {
  assertPlatformRole(params.session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  const request = await prisma.ingredientRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new Error("Ingredient request not found.");
  if (request.status !== "pending") throw new Error("Ingredient request has already been reviewed.");

  await prisma.ingredientRequest.update({
    where: { id: request.id },
    data: {
      status: "rejected",
      reviewedById: params.session.user.id,
      reviewedAt: new Date(),
    },
  });

  await recordAdminAuditLog({
    actorUserId: params.session.user.id,
    organizationId: request.organizationId,
    action: "ingredient_request.rejected",
    targetType: "ingredient_request",
    targetId: request.id,
    details: { requestedName: request.requestedName },
  });
}
