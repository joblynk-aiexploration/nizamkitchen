import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import type { SessionLike } from "@/lib/auth";
import { assertPlatformRole, FULL_PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { recordAdminAuditLog } from "@/server/audit/audit-service";

export async function listCuisines(params?: { countryCode?: string; isGlobal?: boolean }) {
  return prisma.cuisine.findMany({
    where: {
      ...(params?.countryCode !== undefined ? { countryCode: params.countryCode } : {}),
      ...(params?.isGlobal !== undefined ? { isGlobal: params.isGlobal } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { recipes: true } } },
  });
}

export async function getCuisineById(id: string) {
  return prisma.cuisine.findUnique({
    where: { id },
    include: { _count: { select: { recipes: true } } },
  });
}

export async function createCuisine(
  session: SessionLike,
  input: { name: string; description?: string | null; countryCode?: string | null; isGlobal?: boolean },
) {
  assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  const slug = slugify(input.name);
  const cuisine = await prisma.cuisine.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      countryCode: input.countryCode ?? null,
      isGlobal: input.isGlobal ?? true,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "cuisine.created",
    targetType: "cuisine",
    targetId: cuisine.id,
    details: { name: cuisine.name, slug: cuisine.slug },
  });

  return cuisine;
}

export async function updateCuisine(
  session: SessionLike,
  id: string,
  input: { name?: string; description?: string | null; countryCode?: string | null; isGlobal?: boolean },
) {
  assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  const cuisine = await prisma.cuisine.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name, slug: slugify(input.name) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
      ...(input.isGlobal !== undefined ? { isGlobal: input.isGlobal } : {}),
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "cuisine.updated",
    targetType: "cuisine",
    targetId: cuisine.id,
    details: input,
  });

  return cuisine;
}
