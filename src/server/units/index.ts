import { prisma } from "@/lib/prisma";
import type { SessionLike } from "@/lib/auth";
import { assertPlatformRole, FULL_PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { recordAdminAuditLog } from "@/server/audit/audit-service";
import type { UnitType, UnitSystem } from "@prisma/client";

export async function listUnits(params?: { type?: UnitType; system?: UnitSystem }) {
  return prisma.unit.findMany({
    where: {
      ...(params?.type ? { type: params.type } : {}),
      ...(params?.system ? { system: params.system } : {}),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function getUnitById(id: string) {
  return prisma.unit.findUnique({
    where: { id },
    include: {
      conversionsFrom: {
        include: { toUnit: true, ingredient: true },
        orderBy: { toUnit: { name: "asc" } },
      },
    },
  });
}

export async function getUnitByCode(code: string) {
  return prisma.unit.findUnique({ where: { code } });
}

export async function listConversionsForUnit(unitId: string) {
  return prisma.unitConversion.findMany({
    where: { OR: [{ fromUnitId: unitId }, { toUnitId: unitId }] },
    include: {
      fromUnit: true,
      toUnit: true,
      ingredient: true,
    },
    orderBy: { confidence: "desc" },
  });
}

export async function createUnit(
  session: SessionLike,
  input: {
    code: string;
    name: string;
    pluralName: string;
    type: UnitType;
    system: UnitSystem;
    symbol?: string | null;
    isBaseUnit?: boolean;
    isGlobal?: boolean;
  },
) {
  assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  const unit = await prisma.unit.create({
    data: {
      code: input.code,
      name: input.name,
      pluralName: input.pluralName,
      type: input.type,
      system: input.system,
      symbol: input.symbol ?? null,
      isBaseUnit: input.isBaseUnit ?? false,
      isGlobal: input.isGlobal ?? true,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "unit.created",
    targetType: "unit",
    targetId: unit.id,
    details: { code: unit.code, name: unit.name, type: unit.type },
  });

  return unit;
}

export async function createUnitConversion(
  session: SessionLike,
  input: {
    fromUnitId: string;
    toUnitId: string;
    multiplier: number;
    offset?: number | null;
    confidence: number;
    notes?: string | null;
    ingredientId?: string | null;
    isGlobal?: boolean;
    countryCode?: string | null;
  },
) {
  assertPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);

  const conversion = await prisma.unitConversion.create({
    data: {
      fromUnitId: input.fromUnitId,
      toUnitId: input.toUnitId,
      multiplier: input.multiplier,
      offset: input.offset ?? null,
      confidence: input.confidence,
      notes: input.notes ?? null,
      ingredientId: input.ingredientId ?? null,
      isGlobal: input.isGlobal ?? true,
      countryCode: input.countryCode ?? null,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "unit_conversion.created",
    targetType: "unit_conversion",
    targetId: conversion.id,
    details: {
      fromUnitId: conversion.fromUnitId,
      toUnitId: conversion.toUnitId,
      multiplier: conversion.multiplier,
      confidence: conversion.confidence,
    },
  });

  return conversion;
}
