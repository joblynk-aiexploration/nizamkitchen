import {
  FeeCalculationType,
  FeePolicyStatus,
  FeeType,
  Prisma,
  PricingFulfillmentType,
  PricingModule,
  PricingSellerType,
  type PlatformRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

export type ActiveFeePolicy = Prisma.FeePolicyGetPayload<{ include: { rules: true } }>;

type PricingAdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
};

const MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export function assertPricingAdmin(session: PricingAdminSession) {
  if (!session.user.platformRole || !MANAGE_ROLES.includes(session.user.platformRole)) {
    throw new Error("Platform Owner or Platform Admin access is required.");
  }
}

export async function listFeePolicies() {
  return prisma.feePolicy.findMany({
    include: { rules: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function getFeePolicy(id: string) {
  return prisma.feePolicy.findUnique({
    where: { id },
    include: { rules: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}

export async function getActivePricingRules(input: {
  module: PricingModule;
  countryCode: string;
  region?: string | null;
  city?: string | null;
  sellerType?: PricingSellerType | null;
  fulfillmentType?: PricingFulfillmentType | null;
}): Promise<ActiveFeePolicy[]> {
  const now = new Date();
  const policies = await prisma.feePolicy.findMany({
    where: {
      status: FeePolicyStatus.active,
      module: input.module,
      OR: [{ countryCode: input.countryCode }, { countryCode: null }],
      AND: [
        { OR: [{ region: input.region ?? undefined }, { region: null }] },
        { OR: [{ city: input.city ?? undefined }, { city: null }] },
        { OR: [{ sellerType: input.sellerType ?? undefined }, { sellerType: null }] },
        { OR: [{ fulfillmentType: input.fulfillmentType ?? undefined }, { fulfillmentType: null }] },
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
      ],
    },
    include: { rules: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
  return policies as ActiveFeePolicy[];
}

export async function createFeePolicy(session: PricingAdminSession, input: FormData) {
  assertPricingAdmin(session);
  const data = feePolicyDataFromForm(input, session.user.id);
  const policy = await prisma.feePolicy.create({ data });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: policy.countryCode,
    action: "fee_policy.created",
    targetType: "fee_policy",
    targetId: policy.id,
    details: { module: policy.module, status: policy.status },
  });
  return policy;
}

export async function updateFeePolicy(session: PricingAdminSession, id: string, input: FormData) {
  assertPricingAdmin(session);
  const data = feePolicyDataFromForm(input, session.user.id);
  const policy = await prisma.feePolicy.update({
    where: { id },
    data: { ...data, createdById: undefined, updatedById: session.user.id },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: policy.countryCode,
    action: policy.status === FeePolicyStatus.active ? "fee_policy.activated" : "fee_policy.updated",
    targetType: "fee_policy",
    targetId: policy.id,
    details: { module: policy.module, status: policy.status },
  });
  return policy;
}

export async function createFeeRule(session: PricingAdminSession, input: FormData) {
  assertPricingAdmin(session);
  const feePolicyId = stringField(input, "feePolicyId");
  const policy = await prisma.feePolicy.findUnique({ where: { id: feePolicyId } });
  if (!policy) throw new Error("Fee policy not found.");
  const rule = await prisma.feeRule.create({
    data: {
      feePolicyId,
      feeType: stringField(input, "feeType") as FeeType,
      calculationType: stringField(input, "calculationType") as FeeCalculationType,
      percentage: decimalOrNull(input, "percentage"),
      fixedAmount: decimalOrNull(input, "fixedAmount"),
      minAmount: decimalOrNull(input, "minAmount"),
      maxAmount: decimalOrNull(input, "maxAmount"),
      thresholdAmount: decimalOrNull(input, "thresholdAmount"),
      currencyCode: stringField(input, "currencyCode", "USD").toUpperCase(),
      appliesBeforeDiscount: input.get("appliesBeforeDiscount") !== "off",
      taxable: input.get("taxable") === "on",
      displayToCustomer: input.get("displayToCustomer") !== "off",
      displayName: stringField(input, "displayName"),
      sortOrder: integerField(input, "sortOrder", 100),
      isActive: input.get("isActive") !== "off",
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: policy.countryCode,
    action: "fee_policy.updated",
    targetType: "fee_rule",
    targetId: rule.id,
    details: { policyId: policy.id, feeType: rule.feeType, calculationType: rule.calculationType },
  });
  return rule;
}

export function feePolicyDataFromForm(formData: FormData, userId: string) {
  return {
    name: stringField(formData, "name"),
    description: optionalStringField(formData, "description"),
    countryCode: optionalStringField(formData, "countryCode")?.toUpperCase() ?? null,
    region: optionalStringField(formData, "region"),
    city: optionalStringField(formData, "city"),
    module: stringField(formData, "module") as PricingModule,
    sellerType: optionalStringField(formData, "sellerType") as PricingSellerType | null,
    fulfillmentType: optionalStringField(formData, "fulfillmentType") as PricingFulfillmentType | null,
    status: stringField(formData, "status", "draft") as FeePolicyStatus,
    priority: integerField(formData, "priority", 100),
    effectiveFrom: dateOrNull(formData, "effectiveFrom"),
    effectiveTo: dateOrNull(formData, "effectiveTo"),
    rulesJson: jsonField(formData, "rulesJson"),
    createdById: userId,
  };
}

function stringField(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function optionalStringField(formData: FormData, key: string) {
  const value = stringField(formData, key);
  return value.length ? value : null;
}

function integerField(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  if (!Number.isInteger(value)) throw new Error(`${key} must be a whole number.`);
  return value;
}

function decimalOrNull(formData: FormData, key: string) {
  const raw = optionalStringField(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be zero or higher.`);
  return new Prisma.Decimal(value);
}

function dateOrNull(formData: FormData, key: string) {
  const raw = optionalStringField(formData, key);
  return raw ? new Date(raw) : null;
}

function jsonField(formData: FormData, key: string) {
  const raw = optionalStringField(formData, key);
  if (!raw) return {};
  return JSON.parse(raw) as Prisma.InputJsonValue;
}
