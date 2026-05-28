import {
  type MealType,
  type MenuTemplateType,
  type DishTemplateCategory,
  type MenuItemCategory,
  Prisma,
  type SellerType,
  type PlatformRole,
  type UserStatus,
} from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { dishTemplateSchema, menuTemplateSchema } from "@/lib/validation/templates";
import { createAuditEvent } from "@/server/audit";

const TEMPLATE_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];
const TEMPLATE_READ_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];

type AdminSession = {
  user: { id: string; email?: string; status?: UserStatus; platformRole: PlatformRole | null };
};

type TemplateLocation = {
  countryCode?: string | null;
  region?: string | null;
  city?: string | null;
  sellerType?: SellerType | null;
  cuisineId?: string | null;
};

const menuTemplateInclude = {
  items: {
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: {
      dishTemplate: { include: { cuisine: true, ingredients: { orderBy: { displayOrder: "asc" } } } },
      recipe: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.MenuTemplateInclude;

function normalizedText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRegion(value?: string | null) {
  return normalizedText(value)?.toUpperCase() ?? null;
}

function normalizeCity(value?: string | null) {
  return normalizedText(value)?.toLowerCase() ?? null;
}

function normalizeCountry(value?: string | null) {
  return normalizedText(value)?.toUpperCase() ?? null;
}

function locationPriority(template: { countryCode: string | null; region: string | null; city: string | null }, location: TemplateLocation) {
  const city = normalizeCity(location.city);
  const region = normalizeRegion(location.region);
  const countryCode = normalizeCountry(location.countryCode);
  if (city && normalizeCity(template.city) === city) return 400;
  if (region && normalizeRegion(template.region) === region) return 300;
  if (countryCode && template.countryCode === countryCode) return 200;
  if (!template.countryCode && !template.region && !template.city) return 100;
  return 0;
}

function sortByEffectivePriority<T extends { countryCode: string | null; region: string | null; city: string | null; createdAt: Date }>(items: T[], location: TemplateLocation) {
  return [...items].sort((a, b) => {
    const priority = locationPriority(b, location) - locationPriority(a, location);
    if (priority !== 0) return priority;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function parseIngredients(text?: string | null) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [ingredientName, quantity, unitId, preparationNote] = line.split("|").map((part) => part.trim());
      return {
        ingredientName,
        quantity: quantity ? Number(quantity) : null,
        unitId: normalizedText(unitId),
        preparationNote: normalizedText(preparationNote),
        displayOrder: index,
      };
    });
}

function parseSteps(text?: string | null) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, instruction, durationMinutes] = line.split("|").map((part) => part.trim());
      return {
        stepNumber: index + 1,
        title: normalizedText(title),
        instruction: instruction || title,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        displayOrder: index,
      };
    });
}

function parseMenuItems(text?: string | null) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [nameSnapshot, dayOffset, mealSlot, category, priceAmount, currencyCode, dishTemplateId, recipeId] = line
        .split("|")
        .map((part) => part.trim());
      return {
        nameSnapshot,
        dayOffset: dayOffset ? Number(dayOffset) : null,
        mealSlot: normalizedText(mealSlot) as MealType | null,
        category: normalizedText(category) as DishTemplateCategory | null,
        priceAmount: priceAmount ? Number(priceAmount) : null,
        currencyCode: normalizedText(currencyCode),
        dishTemplateId: normalizedText(dishTemplateId),
        recipeId: normalizedText(recipeId),
        displayOrder: index,
      };
    });
}

export async function listDishTemplates(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_READ_ROLES);
  return prisma.dishTemplate.findMany({
    include: {
      cuisine: true,
      _count: { select: { ingredients: true, steps: true, menuTemplateItems: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getDishTemplate(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_READ_ROLES);
  return prisma.dishTemplate.findUnique({
    where: { id },
    include: {
      cuisine: true,
      ingredients: { orderBy: { displayOrder: "asc" } },
      steps: { orderBy: { displayOrder: "asc" } },
      menuTemplateItems: { include: { menuTemplate: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function upsertDishTemplate(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_ADMIN_ROLES);
  const parsed = dishTemplateSchema.parse(input);
  const slug = normalizedText(parsed.slug) ?? slugify(parsed.name);
  const data = {
    name: parsed.name,
    slug,
    description: parsed.description ?? null,
    cuisineId: parsed.cuisineId ?? null,
    countryCode: normalizeCountry(parsed.countryCode),
    region: normalizeRegion(parsed.region),
    city: normalizedText(parsed.city),
    mealType: parsed.mealType ?? null,
    category: parsed.category,
    defaultServings: parsed.defaultServings ?? null,
    defaultPriceAmount: parsed.defaultPriceAmount ?? null,
    currencyCode: normalizeCountry(parsed.currencyCode),
    spiceLevel: parsed.spiceLevel ?? null,
    status: parsed.status,
    visibility: parsed.visibility,
    updatedById: session.user.id,
  };

  const template = parsed.id
    ? await prisma.dishTemplate.update({
        where: { id: parsed.id },
        data: {
          ...data,
          ingredients: { deleteMany: {}, create: parseIngredients(parsed.ingredientsText) },
          steps: { deleteMany: {}, create: parseSteps(parsed.stepsText) },
        },
      })
    : await prisma.dishTemplate.create({
        data: {
          ...data,
          createdById: session.user.id,
          ingredients: { create: parseIngredients(parsed.ingredientsText) },
          steps: { create: parseSteps(parsed.stepsText) },
        },
      });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: template.countryCode,
    action: parsed.id ? "dish_template.updated" : "dish_template.created",
    targetType: "dish_template",
    targetId: template.id,
    details: { name: template.name, status: template.status, city: template.city, region: template.region },
  });

  return template;
}

export async function archiveDishTemplate(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_ADMIN_ROLES);
  const template = await prisma.dishTemplate.update({ where: { id }, data: { status: "archived", updatedById: session.user.id } });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: template.countryCode,
    action: "dish_template.archived",
    targetType: "dish_template",
    targetId: template.id,
    details: { name: template.name },
  });
  return template;
}

export async function cloneDishTemplate(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_ADMIN_ROLES);
  const template = await getDishTemplate(session, id);
  if (!template) throw new Error("Dish template not found.");
  return prisma.dishTemplate.create({
    data: {
      name: `${template.name} Copy`,
      slug: `${template.slug}-copy-${Math.random().toString(36).slice(2, 7)}`,
      description: template.description,
      cuisineId: template.cuisineId,
      countryCode: template.countryCode,
      region: template.region,
      city: template.city,
      mealType: template.mealType,
      category: template.category,
      defaultServings: template.defaultServings,
      defaultPriceAmount: template.defaultPriceAmount,
      currencyCode: template.currencyCode,
      spiceLevel: template.spiceLevel,
      status: "draft",
      visibility: template.visibility,
      createdById: session.user.id,
      ingredients: { create: template.ingredients.map(({ ingredientName, quantity, unitId, preparationNote, displayOrder }) => ({ ingredientName, quantity, unitId, preparationNote, displayOrder })) },
      steps: { create: template.steps.map(({ stepNumber, title, instruction, durationMinutes, displayOrder }) => ({ stepNumber, title, instruction, durationMinutes, displayOrder })) },
    },
  });
}

export async function listMenuTemplates(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_READ_ROLES);
  return prisma.menuTemplate.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getMenuTemplate(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_READ_ROLES);
  return prisma.menuTemplate.findUnique({ where: { id }, include: menuTemplateInclude });
}

export async function upsertMenuTemplate(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_ADMIN_ROLES);
  const parsed = menuTemplateSchema.parse(input);
  const slug = normalizedText(parsed.slug) ?? slugify(parsed.name);
  const data = {
    name: parsed.name,
    slug,
    description: parsed.description ?? null,
    templateType: parsed.templateType,
    countryCode: normalizeCountry(parsed.countryCode),
    region: normalizeRegion(parsed.region),
    city: normalizedText(parsed.city),
    sellerType: parsed.sellerType ?? null,
    householdUseEnabled: parsed.householdUseEnabled,
    sellerUseEnabled: parsed.sellerUseEnabled,
    status: parsed.status,
    visibility: parsed.visibility,
    updatedById: session.user.id,
  };

  const template = parsed.id
    ? await prisma.menuTemplate.update({
        where: { id: parsed.id },
        data: {
          ...data,
          items: { deleteMany: {}, create: parseMenuItems(parsed.itemsText) },
        },
      })
    : await prisma.menuTemplate.create({
        data: {
          ...data,
          createdById: session.user.id,
          items: { create: parseMenuItems(parsed.itemsText) },
        },
      });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: template.countryCode,
    action: parsed.id ? "menu_template.updated" : "menu_template.created",
    targetType: "menu_template",
    targetId: template.id,
    details: { name: template.name, status: template.status, type: template.templateType },
  });

  return template;
}

export async function archiveMenuTemplate(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_ADMIN_ROLES);
  const template = await prisma.menuTemplate.update({ where: { id }, data: { status: "archived", updatedById: session.user.id } });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: template.countryCode,
    action: "menu_template.archived",
    targetType: "menu_template",
    targetId: template.id,
    details: { name: template.name },
  });
  return template;
}

export async function cloneMenuTemplate(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, TEMPLATE_ADMIN_ROLES);
  const template = await getMenuTemplate(session, id);
  if (!template) throw new Error("Menu template not found.");
  return prisma.menuTemplate.create({
    data: {
      name: `${template.name} Copy`,
      slug: `${template.slug}-copy-${Math.random().toString(36).slice(2, 7)}`,
      description: template.description,
      templateType: template.templateType,
      countryCode: template.countryCode,
      region: template.region,
      city: template.city,
      sellerType: template.sellerType,
      householdUseEnabled: template.householdUseEnabled,
      sellerUseEnabled: template.sellerUseEnabled,
      status: "draft",
      visibility: template.visibility,
      createdById: session.user.id,
      items: {
        create: template.items.map(({ dishTemplateId, recipeId, nameSnapshot, dayOffset, mealSlot, category, quantity, priceAmount, currencyCode, displayOrder }) => ({
          dishTemplateId,
          recipeId,
          nameSnapshot,
          dayOffset,
          mealSlot,
          category,
          quantity,
          priceAmount,
          currencyCode,
          displayOrder,
        })),
      },
    },
  });
}

export async function listAvailableMenuTemplates(location: TemplateLocation & { usage: "household" | "seller"; templateType?: string | null }) {
  const geographyOr: Prisma.MenuTemplateWhereInput[] = [
    { countryCode: normalizeCountry(location.countryCode), region: normalizeRegion(location.region), city: normalizedText(location.city) },
    { countryCode: normalizeCountry(location.countryCode), region: normalizeRegion(location.region), city: null },
    { countryCode: normalizeCountry(location.countryCode), region: null, city: null },
    { countryCode: null, region: null, city: null },
  ];
  const templates = await prisma.menuTemplate.findMany({
    where: {
      status: "active",
      ...(location.usage === "household"
        ? { householdUseEnabled: true, visibility: { in: ["public", "household_available"] } }
        : { sellerUseEnabled: true, visibility: { in: ["public", "seller_available"] } }),
      ...(location.templateType ? { templateType: location.templateType as MenuTemplateType } : {}),
      AND: [
        { OR: geographyOr },
        ...(location.sellerType ? [{ OR: [{ sellerType: location.sellerType }, { sellerType: null }] }] : []),
      ],
    },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return sortByEffectivePriority(templates, location);
}

export async function applyMenuTemplateToMealPlan(params: {
  templateId: string;
  organizationId: string;
  countryCode: string;
  actorUserId: string;
  householdSize: number;
  startDate: string;
}) {
  const template = await prisma.menuTemplate.findFirst({
    where: { id: params.templateId, status: "active", householdUseEnabled: true },
    include: menuTemplateInclude,
  });
  if (!template) throw new Error("Meal plan template is not available.");
  const maxDayOffset = Math.max(0, ...template.items.map((item) => item.dayOffset ?? 0));
  const startDate = new Date(`${params.startDate}T00:00:00.000Z`);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + Math.max(0, maxDayOffset));
  const days = Array.from({ length: maxDayOffset + 1 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + index);
    return date;
  });
  const plan = await prisma.mealPlan.create({
    data: {
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      createdById: params.actorUserId,
      name: template.name,
      status: "draft",
      startDate,
      endDate,
      householdSize: params.householdSize,
      notes: `Created from template: ${template.name}`,
      days: {
        create: days.map((date, dayOffset) => ({
          date,
          dayLabel: date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
          entries: {
            create: template.items
              .filter((item) => (item.dayOffset ?? 0) === dayOffset)
              .map((item) => ({
                recipeId: item.recipeId,
                customMealName: item.recipeId ? null : item.nameSnapshot,
                mealType: item.mealSlot ?? "dinner",
                targetServings: Math.max(1, Math.round(item.quantity ?? params.householdSize)),
                notes: item.dishTemplate ? `Dish template: ${item.dishTemplate.name}` : null,
                displayOrder: item.displayOrder,
              })),
          },
        })),
      },
    },
  });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "menu_template.applied_to_meal_plan",
    targetType: "meal_plan",
    targetId: plan.id,
    details: { templateId: template.id, templateName: template.name },
  });
  return plan;
}

export async function applyMenuTemplateToSellerMenu(params: {
  templateId: string;
  organizationId: string;
  countryCode: string;
  currencyCode: string;
  actorUserId: string;
  sellerType: SellerType;
}) {
  const template = await prisma.menuTemplate.findFirst({
    where: {
      id: params.templateId,
      status: "active",
      sellerUseEnabled: true,
      OR: [{ sellerType: params.sellerType }, { sellerType: null }],
    },
    include: menuTemplateInclude,
  });
  if (!template) throw new Error("Seller menu template is not available.");
  const menu = await prisma.menu.create({
    data: {
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      name: template.name,
      description: template.description,
      status: "draft",
      visibility: "private",
      items: {
        create: template.items.map((item) => ({
          organization: { connect: { id: params.organizationId } },
          countryCode: params.countryCode,
          name: item.nameSnapshot,
          slug: `${slugify(item.nameSnapshot)}-${Math.random().toString(36).slice(2, 7)}`,
          description: item.dishTemplate?.description ?? null,
          cuisine: item.dishTemplate?.cuisine?.name ?? null,
          category: (item.category ?? item.dishTemplate?.category ?? "other") as MenuItemCategory,
          priceAmount: item.priceAmount ?? item.dishTemplate?.defaultPriceAmount ?? null,
          currencyCode: item.currencyCode ?? item.dishTemplate?.currencyCode ?? params.currencyCode,
          servingSize: item.quantity ? `${item.quantity}` : item.dishTemplate?.defaultServings ? `${item.dishTemplate.defaultServings} servings` : null,
          spiceLevel: item.dishTemplate?.spiceLevel ?? null,
          preorderRequired: params.sellerType === "home_catering",
          pickupAvailable: true,
          deliveryAvailable: params.sellerType === "restaurant",
          ingredientsSummary: item.dishTemplate
            ? item.dishTemplate.ingredients.map((ingredient) => ingredient.ingredientName).join(", ")
            : null,
          status: "draft",
          isFeatured: item.displayOrder === 0,
        })),
      },
    },
  });
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "menu_template.applied_to_seller_menu",
    targetType: "menu",
    targetId: menu.id,
    details: { templateId: template.id, templateName: template.name, sellerType: params.sellerType },
  });
  return menu;
}
