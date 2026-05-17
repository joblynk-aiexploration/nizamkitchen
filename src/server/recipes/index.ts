import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { SessionLike } from "@/lib/auth";
import { assertPlatformRole, assertMembershipAccess, FULL_PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { recordAdminAuditLog } from "@/server/audit/audit-service";
import { isRecipeVisibleToOrganization } from "@/lib/recipe-utils";
import type { RecipeDifficulty, SpiceLevel, RecipeVisibility, RecipeSourceType } from "@prisma/client";

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
  isPublished: boolean;
  countryCode: string | null;
  organizationId: string | null;
  cuisine: { id: string; name: string; slug: string };
};

export async function listRecipes(params: {
  organizationId?: string | null;
  countryCode?: string;
  cuisineId?: string;
  difficulty?: RecipeDifficulty;
  spiceLevel?: SpiceLevel;
  search?: string;
  publishedOnly?: boolean;
}) {
  const { organizationId, countryCode, cuisineId, difficulty, spiceLevel, search, publishedOnly } = params;

  return prisma.recipe.findMany({
    where: {
      ...qaExcludeFilter(),
      ...(publishedOnly ? { isPublished: true } : {}),
      ...(cuisineId ? { cuisineId } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(spiceLevel ? { spiceLevel } : {}),
      ...(countryCode ? { OR: [{ countryCode: null }, { countryCode }] } : {}),
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
      ...(organizationId
        ? {
            OR: [
              { visibility: "global", isPublished: true },
              { visibility: "organization", organizationId, isPublished: true },
            ],
          }
        : {}),
    },
    include: { cuisine: true },
    orderBy: { name: "asc" },
  });
}

export async function getRecipeById(id: string) {
  return prisma.recipe.findUnique({
    where: { id },
    include: RECIPE_INCLUDE,
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
  },
) {
  const existing = await prisma.recipe.findUniqueOrThrow({ where: { id } });

  if (existing.isGlobal || !existing.organizationId) {
    assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  } else {
    assertMembershipAccess(session, existing.organizationId);
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
  const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id: input.recipeId } });

  if (recipe.isGlobal || !recipe.organizationId) {
    assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  } else {
    assertMembershipAccess(session, recipe.organizationId);
  }

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
  const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id: input.recipeId } });

  if (recipe.isGlobal || !recipe.organizationId) {
    assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  } else {
    assertMembershipAccess(session, recipe.organizationId);
  }

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
