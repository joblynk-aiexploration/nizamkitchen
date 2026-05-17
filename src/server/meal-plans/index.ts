import { Prisma, type MealPlan, type PlatformRole, type SpiceLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPlatformRole, PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  mealPlanCreateSchema,
  mealPlanDuplicateSchema,
  mealPlanEntryCreateSchema,
  mealPlanEntryUpdateSchema,
  mealPlanPreferenceSchema,
  mealPlanUpdateSchema,
  type MealPlanCreateInput,
  type MealPlanEntryCreateInput,
  type MealPlanEntryUpdateInput,
  type MealPlanPreferenceInput,
} from "@/lib/validation/meal-plans";
import { createAuditEvent } from "@/server/audit";
import { generateGroceryList } from "@/server/grocery";

const mealPlanListArgs = Prisma.validator<Prisma.MealPlanDefaultArgs>()({
  include: {
    _count: { select: { days: true, groceryLists: true } },
    days: {
      select: {
        date: true,
        _count: { select: { entries: true } },
      },
      orderBy: { date: "asc" },
    },
  },
});

const mealPlanDetailArgs = Prisma.validator<Prisma.MealPlanDefaultArgs>()({
  include: {
    createdBy: { select: { id: true, fullName: true, email: true } },
    days: {
      orderBy: { date: "asc" },
      include: {
        entries: {
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          include: {
            recipe: {
              include: {
                cuisine: true,
              },
            },
          },
        },
      },
    },
    groceryLists: {
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { items: true, warnings: true } },
      },
    },
  },
});

export type MealPlanListItem = Prisma.MealPlanGetPayload<typeof mealPlanListArgs>;
export type MealPlanDetail = Prisma.MealPlanGetPayload<typeof mealPlanDetailArgs>;

function startOfUtcDay(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function eachUtcDay(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function formatWeekday(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

async function ensureRecipeAccessible(recipeId: string, organizationId: string) {
  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      OR: [
        { organizationId },
        { organizationId: null, isPublished: true, visibility: "global" },
      ],
    },
  });

  if (!recipe) {
    throw new Error("Recipe is not available for this organization.");
  }

  return recipe;
}

async function getMealPlanScoped(id: string, organizationId: string) {
  const plan = await prisma.mealPlan.findFirst({
    where: { id, organizationId },
    ...mealPlanDetailArgs,
  });

  if (!plan) {
    throw new Error("Meal plan not found.");
  }

  return plan;
}

async function getMealPlanDayScoped(mealPlanDayId: string, organizationId: string) {
  const day = await prisma.mealPlanDay.findFirst({
    where: {
      id: mealPlanDayId,
      mealPlan: { organizationId },
    },
    include: {
      mealPlan: true,
      entries: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!day) {
    throw new Error("Meal plan day not found.");
  }

  return day;
}

async function getMealPlanEntryScoped(entryId: string, organizationId: string) {
  const entry = await prisma.mealPlanEntry.findFirst({
    where: {
      id: entryId,
      mealPlanDay: { mealPlan: { organizationId } },
    },
    include: {
      mealPlanDay: {
        include: {
          mealPlan: true,
          entries: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!entry) {
    throw new Error("Meal plan entry not found.");
  }

  return entry;
}

export async function canAccessMealPlanner(params: {
  organizationId: string;
  platformRole: PlatformRole | null | undefined;
}) {
  if (hasPlatformRole(params.platformRole, PLATFORM_ADMIN_ROLES)) {
    return true;
  }

  return isFeatureEnabled("meal_planner", params.organizationId);
}

export async function listMealPlans(organizationId: string) {
  return prisma.mealPlan.findMany({
    where: { organizationId },
    ...mealPlanListArgs,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getMealPlan(id: string, organizationId: string) {
  return getMealPlanScoped(id, organizationId);
}

export async function createMealPlan(params: {
  organizationId: string;
  countryCode: string;
  createdById: string;
  input: unknown;
}) {
  const parsed = mealPlanCreateSchema.parse(params.input);
  const startDate = startOfUtcDay(parsed.startDate);
  const endDate = startOfUtcDay(parsed.endDate);
  const days = eachUtcDay(startDate, endDate);

  const plan = await prisma.mealPlan.create({
    data: {
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      createdById: params.createdById,
      name: parsed.name,
      status: "draft",
      startDate,
      endDate,
      householdSize: parsed.householdSize,
      notes: parsed.notes ?? null,
      days: {
        create: days.map((day) => ({
          date: day,
          dayLabel: formatWeekday(day),
        })),
      },
    },
  });

  await createAuditEvent({
    actorUserId: params.createdById,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "meal_plan.created",
    targetType: "meal_plan",
    targetId: plan.id,
    details: {
      name: parsed.name,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      householdSize: parsed.householdSize,
    },
  });

  return plan;
}

export async function updateMealPlan(params: {
  mealPlanId: string;
  organizationId: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = mealPlanUpdateSchema.parse(params.input);
  const existing = await prisma.mealPlan.findFirst({
    where: { id: params.mealPlanId, organizationId: params.organizationId },
    include: { days: { orderBy: { date: "asc" } } },
  });

  if (!existing) {
    throw new Error("Meal plan not found.");
  }

  const startDate = parsed.startDate ? startOfUtcDay(parsed.startDate) : existing.startDate;
  const endDate = parsed.endDate ? startOfUtcDay(parsed.endDate) : existing.endDate;

  const updated = await prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.update({
      where: { id: params.mealPlanId },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.householdSize !== undefined ? { householdSize: parsed.householdSize } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes ?? null } : {}),
        ...(parsed.startDate !== undefined ? { startDate } : {}),
        ...(parsed.endDate !== undefined ? { endDate } : {}),
      },
    });

    if (parsed.startDate !== undefined || parsed.endDate !== undefined) {
      const desiredDays = eachUtcDay(startDate, endDate);
      const desiredIso = new Set(desiredDays.map((day) => day.toISOString()));
      const existingIso = new Set(existing.days.map((day) => day.date.toISOString()));

      const daysToDelete = existing.days
        .filter((day) => !desiredIso.has(day.date.toISOString()))
        .map((day) => day.id);

      if (daysToDelete.length > 0) {
        await tx.mealPlanDay.deleteMany({
          where: { id: { in: daysToDelete } },
        });
      }

      const daysToCreate = desiredDays.filter((day) => !existingIso.has(day.toISOString()));
      if (daysToCreate.length > 0) {
        await tx.mealPlanDay.createMany({
          data: daysToCreate.map((day) => ({
            mealPlanId: params.mealPlanId,
            date: day,
            dayLabel: formatWeekday(day),
          })),
        });
      }
    }

    return plan;
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: existing.countryCode,
    action: "meal_plan.updated",
    targetType: "meal_plan",
    targetId: params.mealPlanId,
    details: parsed as Prisma.InputJsonValue,
  });

  return updated;
}

export async function duplicateMealPlan(params: {
  mealPlanId: string;
  organizationId: string;
  actorUserId: string;
  input?: unknown;
}) {
  const parsed = mealPlanDuplicateSchema.parse(params.input ?? {});
  const existing = await getMealPlanScoped(params.mealPlanId, params.organizationId);
  const originalStart = new Date(existing.startDate);
  const originalEnd = new Date(existing.endDate);
  const durationDays = Math.floor((originalEnd.getTime() - originalStart.getTime()) / 86_400_000);
  const newStart = parsed.startDate
    ? startOfUtcDay(parsed.startDate)
    : new Date(Date.UTC(
        originalStart.getUTCFullYear(),
        originalStart.getUTCMonth(),
        originalStart.getUTCDate() + 7,
      ));
  const newEnd = new Date(newStart);
  newEnd.setUTCDate(newEnd.getUTCDate() + durationDays);

  const dayOffsetMap = new Map<string, number>(
    existing.days.map((day) => [
      day.id,
      Math.floor((day.date.getTime() - originalStart.getTime()) / 86_400_000),
    ]),
  );

  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.mealPlan.create({
      data: {
        organizationId: existing.organizationId,
        countryCode: existing.countryCode,
        createdById: params.actorUserId,
        name: parsed.name ?? `${existing.name} Copy`,
        status: "draft",
        startDate: newStart,
        endDate: newEnd,
        householdSize: existing.householdSize,
        notes: existing.notes,
      },
    });

    const newDays = await Promise.all(existing.days.map(async (day) => {
      const offset = dayOffsetMap.get(day.id) ?? 0;
      const date = new Date(newStart);
      date.setUTCDate(date.getUTCDate() + offset);
      return tx.mealPlanDay.create({
        data: {
          mealPlanId: created.id,
          date,
          dayLabel: day.dayLabel,
          notes: day.notes,
        },
      });
    }));

    const dayByOffset = new Map<number, string>(
      newDays.map((day) => {
        const offset = Math.floor((day.date.getTime() - newStart.getTime()) / 86_400_000);
        return [offset, day.id];
      }),
    );

    for (const day of existing.days) {
      const offset = dayOffsetMap.get(day.id) ?? 0;
      const targetDayId = dayByOffset.get(offset);
      if (!targetDayId) continue;

      for (const entry of day.entries) {
        await tx.mealPlanEntry.create({
          data: {
            mealPlanDayId: targetDayId,
            recipeId: entry.recipeId,
            customMealName: entry.customMealName,
            mealType: entry.mealType,
            targetServings: entry.targetServings,
            notes: entry.notes,
            status: "planned",
            displayOrder: entry.displayOrder,
          },
        });
      }
    }

    return created;
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: existing.organizationId,
    countryCode: existing.countryCode,
    action: "meal_plan.created",
    targetType: "meal_plan",
    targetId: copy.id,
    details: {
      duplicatedFromMealPlanId: existing.id,
      name: copy.name,
      startDate: newStart.toISOString(),
      endDate: newEnd.toISOString(),
    },
  });

  return copy;
}

export async function deleteMealPlan(params: {
  mealPlanId: string;
  organizationId: string;
  actorUserId: string;
}) {
  const existing = await prisma.mealPlan.findFirst({
    where: { id: params.mealPlanId, organizationId: params.organizationId },
  });

  if (!existing) {
    throw new Error("Meal plan not found.");
  }

  await prisma.mealPlan.delete({
    where: { id: params.mealPlanId },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: existing.countryCode,
    action: "meal_plan.deleted",
    targetType: "meal_plan",
    targetId: params.mealPlanId,
    details: {
      name: existing.name,
      startDate: existing.startDate.toISOString(),
      endDate: existing.endDate.toISOString(),
    },
  });
}

export async function addMealPlanEntry(params: {
  organizationId: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = mealPlanEntryCreateSchema.parse(params.input);
  const day = await getMealPlanDayScoped(parsed.mealPlanDayId, params.organizationId);

  if (parsed.recipeId) {
    await ensureRecipeAccessible(parsed.recipeId, params.organizationId);
  }

  const entry = await prisma.mealPlanEntry.create({
    data: {
      mealPlanDayId: parsed.mealPlanDayId,
      recipeId: parsed.recipeId ?? null,
      customMealName: parsed.recipeId ? null : parsed.customMealName ?? null,
      mealType: parsed.mealType,
      targetServings: parsed.targetServings,
      notes: parsed.notes ?? null,
      status: parsed.status,
      displayOrder: day.entries.length,
    },
    include: {
      recipe: { include: { cuisine: true } },
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: day.mealPlan.countryCode,
    action: "meal_plan_entry.created",
    targetType: "meal_plan_entry",
    targetId: entry.id,
    details: {
      mealPlanId: day.mealPlan.id,
      mealPlanDayId: day.id,
      recipeId: entry.recipeId,
      customMealName: entry.customMealName,
      mealType: entry.mealType,
      targetServings: entry.targetServings,
    },
  });

  return entry;
}

export async function updateMealPlanEntry(params: {
  entryId: string;
  organizationId: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = mealPlanEntryUpdateSchema.parse(params.input);
  const existing = await getMealPlanEntryScoped(params.entryId, params.organizationId);

  const recipeId = parsed.recipeId !== undefined ? parsed.recipeId ?? null : existing.recipeId;
  if (recipeId) {
    await ensureRecipeAccessible(recipeId, params.organizationId);
  }

  const customMealName =
    parsed.recipeId !== undefined && parsed.recipeId
      ? null
      : parsed.customMealName !== undefined
        ? parsed.customMealName ?? null
        : existing.customMealName;

  if (!recipeId && !customMealName) {
    throw new Error("A meal plan entry needs a recipe or custom meal name.");
  }

  const entry = await prisma.mealPlanEntry.update({
    where: { id: params.entryId },
    data: {
      ...(parsed.recipeId !== undefined ? { recipeId } : {}),
      ...(parsed.customMealName !== undefined || parsed.recipeId !== undefined
        ? { customMealName }
        : {}),
      ...(parsed.mealType !== undefined ? { mealType: parsed.mealType } : {}),
      ...(parsed.targetServings !== undefined ? { targetServings: parsed.targetServings } : {}),
      ...(parsed.notes !== undefined ? { notes: parsed.notes ?? null } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      ...(parsed.displayOrder !== undefined ? { displayOrder: parsed.displayOrder } : {}),
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: existing.mealPlanDay.mealPlan.countryCode,
    action: "meal_plan_entry.updated",
    targetType: "meal_plan_entry",
    targetId: entry.id,
    details: parsed as Prisma.InputJsonValue,
  });

  return entry;
}

export async function deleteMealPlanEntry(params: {
  entryId: string;
  organizationId: string;
  actorUserId: string;
}) {
  const existing = await getMealPlanEntryScoped(params.entryId, params.organizationId);

  await prisma.mealPlanEntry.delete({
    where: { id: params.entryId },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: existing.mealPlanDay.mealPlan.countryCode,
    action: "meal_plan_entry.deleted",
    targetType: "meal_plan_entry",
    targetId: params.entryId,
    details: {
      mealPlanId: existing.mealPlanDay.mealPlan.id,
      mealPlanDayId: existing.mealPlanDayId,
    },
  });
}

export async function moveMealPlanEntry(params: {
  entryId: string;
  organizationId: string;
  actorUserId: string;
  direction: "up" | "down";
}) {
  const existing = await getMealPlanEntryScoped(params.entryId, params.organizationId);
  const entries = existing.mealPlanDay.entries;
  const index = entries.findIndex((entry) => entry.id === params.entryId);
  if (index === -1) {
    throw new Error("Meal plan entry not found.");
  }

  const swapIndex = params.direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= entries.length) {
    return existing;
  }

  const current = entries[index];
  const target = entries[swapIndex];

  await prisma.$transaction([
    prisma.mealPlanEntry.update({
      where: { id: current.id },
      data: { displayOrder: target.displayOrder },
    }),
    prisma.mealPlanEntry.update({
      where: { id: target.id },
      data: { displayOrder: current.displayOrder },
    }),
  ]);

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: existing.mealPlanDay.mealPlan.countryCode,
    action: "meal_plan_entry.updated",
    targetType: "meal_plan_entry",
    targetId: params.entryId,
    details: {
      direction: params.direction,
      mealPlanDayId: existing.mealPlanDayId,
    },
  });

  return getMealPlanEntryScoped(params.entryId, params.organizationId);
}

export async function updateMealPlanPreference(params: {
  organizationId: string;
  actorUserId: string;
  countryCode: string;
  input: unknown;
}) {
  const parsed = mealPlanPreferenceSchema.parse(params.input);

  const preference = await prisma.mealPlanPreference.upsert({
    where: { organizationId: params.organizationId },
    update: {
      defaultHouseholdSize: parsed.defaultHouseholdSize ?? null,
      defaultCountryCode: parsed.defaultCountryCode ?? null,
      preferredCuisines: parsed.preferredCuisines,
      avoidedIngredients: parsed.avoidedIngredients,
      spicePreference: (parsed.spicePreference ?? null) as SpiceLevel | null,
      dietaryNotes: parsed.dietaryNotes ?? null,
      weeklyCookingDays: parsed.weeklyCookingDays,
      measurementSystem: parsed.measurementSystem ?? null,
    },
    create: {
      organizationId: params.organizationId,
      defaultHouseholdSize: parsed.defaultHouseholdSize ?? null,
      defaultCountryCode: parsed.defaultCountryCode ?? null,
      preferredCuisines: parsed.preferredCuisines,
      avoidedIngredients: parsed.avoidedIngredients,
      spicePreference: (parsed.spicePreference ?? null) as SpiceLevel | null,
      dietaryNotes: parsed.dietaryNotes ?? null,
      weeklyCookingDays: parsed.weeklyCookingDays,
      measurementSystem: parsed.measurementSystem ?? null,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId,
    countryCode: params.countryCode,
    action: "meal_preferences.updated",
    targetType: "meal_plan_preference",
    targetId: preference.id,
    details: parsed as Prisma.InputJsonValue,
  });

  return preference;
}

export async function getMealPlanPreference(organizationId: string) {
  return prisma.mealPlanPreference.findUnique({
    where: { organizationId },
  });
}

export async function generateGroceryListFromMealPlan(params: {
  organizationId: string;
  mealPlanId: string;
  createdById: string;
}) {
  const mealPlan = await prisma.mealPlan.findFirst({
    where: {
      id: params.mealPlanId,
      organizationId: params.organizationId,
    },
    include: {
      days: {
        orderBy: { date: "asc" },
        include: {
          entries: {
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!mealPlan) {
    throw new Error("Meal plan not found.");
  }

  const recipeEntries = mealPlan.days.flatMap((day) =>
    day.entries
      .filter((entry) => entry.recipeId && (entry.status === "planned" || entry.status === "cooked"))
      .map((entry) => ({
        recipeId: entry.recipeId!,
        targetServings: entry.targetServings,
        mealSlot: entry.mealType,
        plannedDate: day.date,
      })),
  );

  if (recipeEntries.length === 0) {
    throw new Error("Add at least one recipe meal before generating a grocery list.");
  }

  const list = await generateGroceryList({
    organizationId: params.organizationId,
    countryCode: mealPlan.countryCode,
    createdById: params.createdById,
    input: {
      name: `${mealPlan.name} Grocery List`,
      recipes: recipeEntries.map((entry) => ({
        recipeId: entry.recipeId,
        targetServings: entry.targetServings,
        mealSlot: entry.mealSlot,
      })),
      notes: mealPlan.notes ?? undefined,
      householdSize: mealPlan.householdSize,
    },
    sourceType: "meal_plan",
    mealPlanId: mealPlan.id,
    plannedStartDate: mealPlan.startDate,
    plannedEndDate: mealPlan.endDate,
    recipeTimeline: recipeEntries.map((entry) => ({
      recipeId: entry.recipeId,
      targetServings: entry.targetServings,
      mealSlot: entry.mealSlot,
      plannedDate: entry.plannedDate,
    })),
  });

  await createAuditEvent({
    actorUserId: params.createdById,
    organizationId: params.organizationId,
    countryCode: mealPlan.countryCode,
    action: "meal_plan.grocery_list_generated",
    targetType: "meal_plan",
    targetId: mealPlan.id,
    details: {
      groceryListId: list.id,
      groceryListName: list.name,
      recipeEntryCount: recipeEntries.length,
    },
  });

  return list;
}

export function buildMealPlanDays(input: MealPlanCreateInput) {
  const parsed = mealPlanCreateSchema.parse(input);
  return eachUtcDay(startOfUtcDay(parsed.startDate), startOfUtcDay(parsed.endDate));
}

export function buildMealPlanEntryPayload(input: MealPlanEntryCreateInput) {
  return mealPlanEntryCreateSchema.parse(input);
}

export function buildMealPlanEntryUpdatePayload(input: MealPlanEntryUpdateInput) {
  return mealPlanEntryUpdateSchema.parse(input);
}

export function buildMealPlanPreferencePayload(input: MealPlanPreferenceInput) {
  return mealPlanPreferenceSchema.parse(input);
}

export function toMealPlanDateRange(plan: Pick<MealPlan, "startDate" | "endDate">) {
  return `${plan.startDate.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })} - ${plan.endDate.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}`;
}
