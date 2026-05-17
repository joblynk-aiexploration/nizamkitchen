import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import type { GroceryListUpdateInput, GroceryItemUpdateInput } from "@/lib/validation/grocery";

const GROCERY_LIST_INCLUDE = {
  recipes: { orderBy: { createdAt: "asc" as const } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      ingredient: true,
      unit: true,
      sources: { orderBy: { createdAt: "asc" as const } },
    },
  },
  warnings: { orderBy: { severity: "asc" as const } },
} as const;

export async function listGroceryLists(organizationId: string) {
  return prisma.groceryList.findMany({
    where: { organizationId },
    include: {
      recipes: { select: { recipeNameSnapshot: true } },
      _count: { select: { items: true, warnings: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGroceryList(id: string, organizationId: string) {
  return prisma.groceryList.findFirst({
    where: { id, organizationId },
    include: GROCERY_LIST_INCLUDE,
  });
}

export async function updateGroceryList(
  id: string,
  organizationId: string,
  actorUserId: string,
  input: GroceryListUpdateInput,
) {
  const list = await prisma.groceryList.update({
    where: { id, organizationId },
    data: input,
  });
  await createAuditEvent({
    actorUserId,
    organizationId,
    action: "grocery_list.updated",
    targetType: "grocery_list",
    targetId: id,
    details: input as unknown as Prisma.InputJsonValue,
  });
  return list;
}

export async function updateGroceryItem(
  itemId: string,
  groceryListId: string,
  organizationId: string,
  actorUserId: string,
  input: GroceryItemUpdateInput,
) {
  // Verify the item belongs to an org-owned list
  const item = await prisma.groceryListItem.findFirst({
    where: { id: itemId, groceryListId, groceryList: { organizationId } },
  });
  if (!item) return null;
  return prisma.groceryListItem.update({ where: { id: itemId }, data: input });
}

export async function deleteGroceryList(id: string, organizationId: string, actorUserId: string) {
  await prisma.groceryList.delete({ where: { id, organizationId } });
  await createAuditEvent({
    actorUserId,
    organizationId,
    action: "grocery_list.deleted",
    targetType: "grocery_list",
    targetId: id,
  });
}

export async function listAdminGroceryWarnings(limit = 100) {
  return prisma.groceryConversionWarning.findMany({
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      groceryList: { select: { name: true, organizationId: true } },
      ingredient: { select: { canonicalName: true } },
    },
  });
}
