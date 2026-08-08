import { MenuItemStatus, OrganizationType, Prisma, SellerType, type PlatformRole, type UserStatus } from "@prisma/client";
import { assertCountryAccess, assertPlatformRole, hasPlatformRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { adminMenuItemStatusSchema, menuItemSchema, menuSchema } from "@/lib/validation/menus";
import { createAuditEvent } from "@/server/audit";
import { assertMenuItemLimit } from "@/server/billing";
import { hasAcceptedLatestRequiredDocuments } from "@/server/legal/legal-service";
import { assertSellerGate, getSellerVerificationGate } from "@/server/seller-verification-gates";
import { assertStorageFileBelongsToOrganization } from "@/server/storage/storage-images";

const MENU_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin"];
const MENU_READ_ADMIN_ROLES: PlatformRole[] = [...MENU_ADMIN_ROLES, "auditor"];

type AdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

const menuItemPublicArgs = Prisma.validator<Prisma.MenuItemDefaultArgs>()({
  include: {
    availability: { orderBy: { dayOfWeek: "asc" } },
    menu: { select: { id: true, name: true, visibility: true, status: true } },
  },
});

export type PublicMenuItem = Prisma.MenuItemGetPayload<typeof menuItemPublicArgs>;

function assertMenuOwnerType(organizationType: string) {
  if (organizationType !== OrganizationType.home_catering && organizationType !== OrganizationType.restaurant) {
    throw new Error("Menu tools are available only for home catering and restaurant organizations.");
  }
}

function ownerFeatureFlag(organizationType: string) {
  return organizationType === OrganizationType.home_catering ? "home_catering" : "restaurant_profiles";
}

function sellerTypeFromOrganizationType(organizationType: string): SellerType | null {
  if (organizationType === OrganizationType.home_catering) return SellerType.home_catering;
  if (organizationType === OrganizationType.restaurant) return SellerType.restaurant;
  return null;
}

export async function canAccessMenus(params: {
  organizationId: string | null;
  organizationType?: string | null;
  platformRole?: PlatformRole | null;
}) {
  if (hasPlatformRole(params.platformRole, ["platform_owner", "platform_admin", "support_admin"])) {
    return true;
  }
  if (!params.organizationType) return false;
  const [ownerFlag, menuFlag] = await Promise.all([
    isFeatureEnabled(ownerFeatureFlag(params.organizationType), params.organizationId),
    isFeatureEnabled("menus", params.organizationId),
  ]);
  return ownerFlag && menuFlag;
}

export async function listMenusForOrganization(organizationId: string) {
  return prisma.menu.findMany({
    where: { organizationId },
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMenuForOrganization(organizationId: string, menuId: string) {
  return prisma.menu.findFirst({
    where: { id: menuId, organizationId },
    include: { items: { orderBy: [{ isFeatured: "desc" }, { name: "asc" }] } },
  });
}

export async function upsertMenu(params: {
  organizationId: string;
  countryCode: string;
  organizationType: string;
  actorUserId: string;
  input: unknown;
}) {
  assertMenuOwnerType(params.organizationType);
  const parsed = menuSchema.parse(params.input);
  const existing = parsed.menuId
    ? await prisma.menu.findFirst({ where: { id: parsed.menuId, organizationId: params.organizationId } })
    : null;

  const menu = existing
    ? await prisma.menu.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          description: parsed.description ?? null,
          status: parsed.status,
          visibility: parsed.visibility,
        },
      })
    : await prisma.menu.create({
        data: {
          organizationId: params.organizationId,
          countryCode: params.countryCode,
          name: parsed.name,
          description: parsed.description ?? null,
          status: parsed.status,
          visibility: parsed.visibility,
        },
      });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: existing ? "menu.updated" : "menu.created",
    targetType: "menu",
    targetId: menu.id,
    details: { name: menu.name, status: menu.status, visibility: menu.visibility },
  });

  return menu;
}

export async function listMenuItemsForOrganization(organizationId: string) {
  return prisma.menuItem.findMany({
    where: { organizationId },
    include: { menu: { select: { id: true, name: true } }, availability: { orderBy: { dayOfWeek: "asc" } } },
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getMenuItemForOrganization(organizationId: string, menuItemId: string) {
  return prisma.menuItem.findFirst({
    where: { id: menuItemId, organizationId },
    include: { menu: true, availability: { orderBy: { dayOfWeek: "asc" } } },
  });
}

export async function upsertMenuItem(params: {
  organizationId: string;
  countryCode: string;
  organizationType: string;
  actorUserId: string;
  input: unknown;
}) {
  assertMenuOwnerType(params.organizationType);
  const parsed = menuItemSchema.parse(params.input);
  const existing = parsed.menuItemId
    ? await prisma.menuItem.findFirst({ where: { id: parsed.menuItemId, organizationId: params.organizationId } })
    : null;

  if (parsed.menuId) {
    const menu = await prisma.menu.findFirst({ where: { id: parsed.menuId, organizationId: params.organizationId }, select: { id: true } });
    if (!menu) throw new Error("Menu not found for this organization.");
  }
  await assertStorageFileBelongsToOrganization(parsed.photoFileId, params.organizationId);
  const sellerType = sellerTypeFromOrganizationType(params.organizationType);
  if (sellerType && (parsed.status === "active" || parsed.status === "sold_out")) {
    const legalAcceptance = await hasAcceptedLatestRequiredDocuments({
      user: { id: params.actorUserId, platformRole: null },
      activeOrganization: {
        id: params.organizationId,
        organizationType: params.organizationType as OrganizationType,
        countryCode: params.countryCode,
      },
    });
    if (!legalAcceptance.accepted) {
      throw new Error("Accept the required seller agreements before publishing menu items.");
    }
    await assertSellerGate({
      organizationId: params.organizationId,
      sellerType,
      countryCode: params.countryCode,
      capability: "menu_publishing",
      message: "Complete verification before publishing menu items.",
    });
  }

  if (!existing) {
    await assertMenuItemLimit(params.organizationId);
  }

  const baseSlug = slugify(parsed.name);
  const slug = existing?.slug ?? `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  const data = {
    menuId: parsed.menuId ?? null,
    countryCode: params.countryCode,
    name: parsed.name,
    slug,
    description: parsed.description ?? null,
    cuisine: parsed.cuisine ?? null,
    category: parsed.category,
    priceAmount: parsed.priceAmount ?? null,
    currencyCode: parsed.currencyCode,
    servingSize: parsed.servingSize ?? null,
    spiceLevel: parsed.spiceLevel ?? null,
    preparationTimeMinutes: parsed.preparationTimeMinutes ?? null,
    minimumOrderQuantity: parsed.minimumOrderQuantity ?? null,
    maxDailyQuantity: parsed.maxDailyQuantity ?? null,
    availableFrom: parsed.availableFrom ?? null,
    availableUntil: parsed.availableUntil ?? null,
    preorderRequired: parsed.preorderRequired,
    minimumNoticeHours: parsed.minimumNoticeHours ?? null,
    pickupAvailable: parsed.pickupAvailable,
    deliveryAvailable: parsed.deliveryAvailable,
    photoUrl: parsed.photoUrl ?? null,
    photoFileId: parsed.photoFileId ?? null,
    allergensJson: parsed.allergens.length > 0 ? parsed.allergens : Prisma.JsonNull,
    ingredientsSummary: parsed.ingredientsSummary ?? null,
    status: parsed.status,
    isFeatured: parsed.isFeatured,
  };

  const item = existing
    ? await prisma.menuItem.update({ where: { id: existing.id }, data })
    : await prisma.menuItem.create({ data: { ...data, organizationId: params.organizationId } });

  await prisma.$transaction([
    prisma.menuItemAvailability.deleteMany({ where: { menuItemId: item.id } }),
    ...parsed.availableDays.map((dayOfWeek) =>
      prisma.menuItemAvailability.create({
        data: { menuItemId: item.id, dayOfWeek, isAvailable: true },
      }),
    ),
  ]);

  const action =
    item.status === "sold_out"
      ? "menu_item.sold_out"
      : item.status === "paused"
        ? "menu_item.paused"
        : item.status === "archived"
          ? "menu_item.archived"
          : existing
            ? "menu_item.updated"
            : "menu_item.created";

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action,
    targetType: "menu_item",
    targetId: item.id,
    details: { name: item.name, status: item.status, category: item.category },
  });

  return item;
}

export async function listPublicMenuItemsForOrganization(organizationId: string, filters?: { category?: string }) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, organizationType: true, countryCode: true, status: true },
  });
  const sellerType = organization ? sellerTypeFromOrganizationType(organization.organizationType) : null;
  if (!organization || organization.status === "suspended" || organization.status === "disabled") return [];
  if (sellerType) {
    const gate = await getSellerVerificationGate({
      organizationId,
      sellerType,
      countryCode: organization.countryCode,
      capability: "public_profile",
    });
    if (!gate.allowed) return [];
  }
  const items = await prisma.menuItem.findMany({
    where: {
      organizationId,
      status: { in: ["active", "sold_out"] },
      menu: { status: "active", visibility: "public" },
      ...(filters?.category ? { category: filters.category as never } : {}),
    },
    ...menuItemPublicArgs,
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  });
  return items;
}

export async function listAdminMenuItems(
  session: AdminSession,
  filters: { countryCode?: string; status?: string },
) {
  assertPlatformRole(session.user.platformRole, MENU_READ_ADMIN_ROLES);
  const isCountryManager = session.user.platformRole === "country_manager";
  const assignedCountries = session.countryAssignments.map((assignment) => assignment.countryCode);
  if (isCountryManager && filters.countryCode) assertCountryAccess(session, filters.countryCode);

  return prisma.menuItem.findMany({
    where: {
      countryCode: isCountryManager
        ? filters.countryCode || { in: assignedCountries }
        : filters.countryCode || undefined,
      status: filters.status ? (filters.status as MenuItemStatus) : undefined,
    },
    include: { organization: { select: { id: true, name: true, organizationType: true, countryCode: true } }, menu: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function moderateMenuItem(params: {
  session: AdminSession;
  menuItemId: string;
  input: unknown;
}) {
  assertPlatformRole(params.session.user.platformRole, MENU_ADMIN_ROLES);
  const parsed = adminMenuItemStatusSchema.parse(params.input);
  const existing = await prisma.menuItem.findUnique({ where: { id: params.menuItemId } });
  if (!existing) throw new Error("Menu item not found.");
  if (params.session.user.platformRole === "country_manager") assertCountryAccess(params.session, existing.countryCode);

  const item = await prisma.menuItem.update({
    where: { id: existing.id },
    data: { status: parsed.status },
  });

  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: item.organizationId,
    countryCode: item.countryCode,
    action: "menu_item.moderated",
    targetType: "menu_item",
    targetId: item.id,
    details: { oldStatus: existing.status, newStatus: item.status, reason: parsed.reason ?? null },
  });

  return item;
}
