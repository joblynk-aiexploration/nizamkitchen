import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { SessionLike } from "@/lib/auth";
import { assertPlatformRole, assertMembershipAccess, FULL_PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { recordAdminAuditLog } from "@/server/audit/audit-service";
import type { IngredientCategory } from "@prisma/client";

export async function listIngredients(params?: {
  organizationId?: string | null;
  countryCode?: string;
  category?: IngredientCategory;
  isGlobal?: boolean;
  search?: string;
}) {
  return prisma.ingredient.findMany({
    where: {
      isActive: true,
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { canonicalName: { contains: params.search, mode: "insensitive" } },
              { aliases: { some: { alias: { contains: params.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
      ...(params?.organizationId !== undefined
        ? {
            OR: [
              { isGlobal: true },
              { organizationId: params.organizationId },
            ],
          }
        : {}),
      ...(params?.category ? { category: params.category } : {}),
      ...(params?.isGlobal !== undefined ? { isGlobal: params.isGlobal } : {}),
      ...(params?.countryCode ? { OR: [{ countryCode: null }, { countryCode: params.countryCode }] } : {}),
    },
    include: {
      aliases: { orderBy: { confidence: "desc" } },
      defaultUnit: true,
      _count: { select: { recipeIngredients: true } },
    },
    orderBy: { canonicalName: "asc" },
  });
}

export async function getIngredientById(id: string) {
  return prisma.ingredient.findUnique({
    where: { id },
    include: {
      aliases: { orderBy: { confidence: "desc" } },
      defaultUnit: true,
      unitConversions: { include: { fromUnit: true, toUnit: true } },
      _count: { select: { recipeIngredients: true } },
    },
  });
}

export async function createIngredient(
  session: SessionLike,
  input: {
    name: string;
    canonicalName: string;
    slug?: string | null;
    category: IngredientCategory;
    defaultUnitId?: string | null;
    densityGramPerMl?: number | null;
    averagePieceWeightGrams?: number | null;
    isGlobal?: boolean;
    organizationId?: string | null;
    countryCode?: string | null;
  },
) {
  // Platform admins can create global ingredients; org members can create org-scoped
  if (input.isGlobal) {
    assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  } else {
    assertMembershipAccess(session, input.organizationId ?? undefined);
  }

  const slug = input.slug ?? slugify(input.canonicalName);

  const ingredient = await prisma.ingredient.create({
    data: {
      name: input.name,
      canonicalName: input.canonicalName,
      slug,
      category: input.category,
      defaultUnitId: input.defaultUnitId ?? null,
      densityGramPerMl: input.densityGramPerMl ?? null,
      averagePieceWeightGrams: input.averagePieceWeightGrams ?? null,
      isGlobal: input.isGlobal ?? true,
      isActive: true,
      organizationId: input.organizationId ?? null,
      countryCode: input.countryCode ?? null,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    organizationId: input.organizationId ?? null,
    action: "ingredient.created",
    targetType: "ingredient",
    targetId: ingredient.id,
    details: { name: ingredient.name, slug: ingredient.slug, category: ingredient.category },
  });

  return ingredient;
}

export async function updateIngredient(
  session: SessionLike,
  id: string,
  input: {
    name?: string;
    canonicalName?: string;
    category?: IngredientCategory;
    defaultUnitId?: string | null;
    densityGramPerMl?: number | null;
    averagePieceWeightGrams?: number | null;
    isActive?: boolean;
  },
) {
  assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  const ingredient = await prisma.ingredient.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.canonicalName ? { canonicalName: input.canonicalName, slug: slugify(input.canonicalName) } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.defaultUnitId !== undefined ? { defaultUnitId: input.defaultUnitId } : {}),
      ...(input.densityGramPerMl !== undefined ? { densityGramPerMl: input.densityGramPerMl } : {}),
      ...(input.averagePieceWeightGrams !== undefined ? { averagePieceWeightGrams: input.averagePieceWeightGrams } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "ingredient.updated",
    targetType: "ingredient",
    targetId: ingredient.id,
    details: input,
  });

  return ingredient;
}

export async function addIngredientAlias(
  session: SessionLike,
  input: {
    ingredientId: string;
    alias: string;
    language?: string | null;
    countryCode?: string | null;
    confidence?: number;
  },
) {
  assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  return prisma.ingredientAlias.create({
    data: {
      ingredientId: input.ingredientId,
      alias: input.alias,
      language: input.language ?? null,
      countryCode: input.countryCode ?? null,
      confidence: input.confidence ?? 1.0,
    },
  });
}
