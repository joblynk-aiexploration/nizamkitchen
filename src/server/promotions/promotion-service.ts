import {
  OrganizationType,
  Prisma,
  type PlatformRole,
  type Promotion,
  type PromotionModule,
} from "@prisma/client";
import { z } from "zod";
import { assertCountryAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

type AdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
  countryAssignments?: Array<{ countryCode: string }>;
};

type SellerSession = {
  user: { id: string };
  activeOrganization: { id: string; organizationType: OrganizationType; countryCode: string; currencyCode: string };
  activeMembership: { role: string };
};

const optionalMoney = z
  .preprocess((value) => (value === "" || value == null ? undefined : Number(value)), z.number().min(0).optional());

const optionalDate = z.preprocess(
  (value) => (value === "" || value == null ? undefined : new Date(String(value))),
  z.date().optional(),
);

const basePromotionSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  promotionType: z.enum(["promo_code", "seller_discount", "referral_reward", "loyalty_credit", "manual_credit"]).default("promo_code"),
  discountType: z.enum(["percent", "fixed_amount", "free_delivery", "credit_amount"]),
  status: z.enum(["draft", "active", "disabled", "expired", "archived"]).default("draft"),
  scope: z.enum(["platform", "seller"]).default("platform"),
  sellerOrganizationId: z.string().optional().or(z.literal("")),
  countryCode: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  currencyCode: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
  percentOff: optionalMoney,
  amountOff: optionalMoney,
  minOrderAmount: optionalMoney,
  maxDiscountAmount: optionalMoney,
  startsAt: optionalDate,
  endsAt: optionalDate,
  usageLimit: z.coerce.number().int().min(1).optional().or(z.literal("")),
  perUserLimit: z.coerce.number().int().min(1).optional().or(z.literal("")),
  appliesToFoodOrders: z.coerce.boolean().default(true),
  appliesToHomeChefRequests: z.coerce.boolean().default(true),
  appliesToSubscriptions: z.coerce.boolean().default(false),
});

const creditGrantSchema = z.object({
  organizationId: z.string().optional().or(z.literal("")),
  userId: z.string().optional().or(z.literal("")),
  currencyCode: z.string().trim().length(3).toUpperCase(),
  amount: z.coerce.number().positive().max(100_000),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

const referralCodeSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  ownerUserId: z.string().min(1),
  ownerOrganizationId: z.string().optional().or(z.literal("")),
  countryCode: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  usageLimit: z.coerce.number().int().min(1).optional().or(z.literal("")),
  rewardCreditAmount: optionalMoney,
  rewardCurrencyCode: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
});

export type PromotionEvaluation = {
  promotion: Promotion;
  originalAmount: number;
  discountAmount: number;
  payableAmount: number;
  reason: string;
};

export function normalizePromotionCode(code: string) {
  return code.trim().toUpperCase();
}

export function calculateNetPayable(amount: number | null | undefined, discount?: number | null, credit?: number | null) {
  return roundMoney(Math.max(0, Number(amount ?? 0) - Number(discount ?? 0) - Number(credit ?? 0)));
}

export async function listAdminPromotions(session: AdminSession) {
  const where = countryScopedWhere(session);
  return prisma.promotion.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { sellerOrganization: { select: { id: true, name: true, organizationType: true } }, redemptions: true },
    take: 200,
  });
}

export async function getAdminPromotion(session: AdminSession, id: string) {
  const promotion = await prisma.promotion.findUnique({
    where: { id },
    include: { sellerOrganization: { select: { id: true, name: true, organizationType: true } }, redemptions: { orderBy: { createdAt: "desc" }, take: 100 } },
  });
  if (!promotion) return null;
  if (promotion.countryCode) assertCountryAccess(session as never, promotion.countryCode);
  return promotion;
}

export async function createAdminPromotion(session: AdminSession, input: unknown) {
  assertPromotionManager(session);
  const parsed = basePromotionSchema.parse(input);
  if (parsed.countryCode) assertCountryAccess(session as never, parsed.countryCode);
  const data = promotionDataFromInput(parsed, session.user.id);
  const promotion = await prisma.promotion.create({ data });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: promotion.sellerOrganizationId,
    countryCode: promotion.countryCode,
    action: "promotion.created",
    targetType: "promotion",
    targetId: promotion.id,
    details: { code: promotion.code, scope: promotion.scope, discountType: promotion.discountType },
  });
  return promotion;
}

export async function listSellerPromotions(session: SellerSession) {
  assertSellerCanManagePromotions(session);
  return prisma.promotion.findMany({
    where: { sellerOrganizationId: session.activeOrganization.id, status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
    include: { redemptions: true },
  });
}

export async function createSellerPromotion(session: SellerSession, input: unknown) {
  assertSellerCanManagePromotions(session);
  const raw = input instanceof FormData ? Object.fromEntries(input) : typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const parsed = basePromotionSchema.parse({
    ...raw,
    scope: "seller",
    sellerOrganizationId: session.activeOrganization.id,
    countryCode: session.activeOrganization.countryCode,
    currencyCode: session.activeOrganization.currencyCode,
    promotionType: "seller_discount",
  });
  const promotion = await prisma.promotion.create({ data: promotionDataFromInput(parsed, session.user.id) });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: session.activeOrganization.id,
    countryCode: session.activeOrganization.countryCode,
    action: "promotion.created",
    targetType: "promotion",
    targetId: promotion.id,
    details: { code: promotion.code, sellerManaged: true },
  });
  return promotion;
}

export async function validatePromotionForCheckout(input: {
  code?: string | null;
  module: PromotionModule;
  userId?: string | null;
  organizationId?: string | null;
  sellerOrganizationId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  amount: number;
  currencyCode: string;
  now?: Date;
}): Promise<PromotionEvaluation | null> {
  if (!input.code?.trim()) return null;
  const now = input.now ?? new Date();
  const code = normalizePromotionCode(input.code);
  const promotion = await prisma.promotion.findUnique({ where: { code } });
  if (!promotion) throw new Error("This promo code is not valid.");
  if (promotion.status !== "active") throw new Error("This promo code is not active.");
  if (promotion.startsAt && promotion.startsAt > now) throw new Error("This promo code is not active yet.");
  if (promotion.endsAt && promotion.endsAt < now) throw new Error("This promo code has expired.");
  if (promotion.countryCode && promotion.countryCode !== input.countryCode) throw new Error("This promo code is not available in your country.");
  if (promotion.city && normalizeLocation(promotion.city) !== normalizeLocation(input.city)) throw new Error("This promo code is not available in your city.");
  if (promotion.sellerOrganizationId && promotion.sellerOrganizationId !== input.sellerOrganizationId) {
    throw new Error("This promo code is not available for this seller.");
  }
  if (promotion.currencyCode && promotion.currencyCode !== input.currencyCode.toUpperCase()) {
    throw new Error("This promo code is not available for this currency.");
  }
  if (!promotionAppliesToModule(promotion, input.module)) throw new Error("This promo code is not available for this checkout.");
  if (promotion.minOrderAmount && input.amount < Number(promotion.minOrderAmount)) {
    throw new Error(`This promo code requires a minimum order of ${promotion.currencyCode ?? input.currencyCode} ${Number(promotion.minOrderAmount).toFixed(2)}.`);
  }
  if (promotion.usageLimit) {
    const totalRedemptions = await prisma.promotionRedemption.count({ where: { promotionId: promotion.id, status: { in: ["reserved", "applied"] } } });
    if (totalRedemptions >= promotion.usageLimit) throw new Error("This promo code has reached its usage limit.");
  }
  if (promotion.perUserLimit && input.userId) {
    const userRedemptions = await prisma.promotionRedemption.count({
      where: { promotionId: promotion.id, userId: input.userId, status: { in: ["reserved", "applied"] } },
    });
    if (userRedemptions >= promotion.perUserLimit) throw new Error("You have already used this promo code.");
  }
  const discountAmount = calculatePromotionDiscount(promotion, input.amount);
  if (discountAmount <= 0) throw new Error("This promo code does not apply a discount to this checkout.");
  return {
    promotion,
    originalAmount: roundMoney(input.amount),
    discountAmount,
    payableAmount: calculateNetPayable(input.amount, discountAmount),
    reason: "Promotion validated server-side.",
  };
}

export async function redeemPromotion(input: PromotionEvaluation & {
  userId?: string | null;
  organizationId?: string | null;
  sellerOrganizationId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  module: PromotionModule;
  moduleEntityId: string;
  paymentOrderId?: string | null;
  currencyCode?: string | null;
}) {
  return prisma.promotionRedemption.upsert({
    where: {
      promotionId_module_moduleEntityId: {
        promotionId: input.promotion.id,
        module: input.module,
        moduleEntityId: input.moduleEntityId,
      },
    },
    update: {
      discountAmount: new Prisma.Decimal(input.discountAmount),
      paymentOrderId: input.paymentOrderId ?? undefined,
      status: "applied",
    },
    create: {
      promotionId: input.promotion.id,
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      sellerOrganizationId: input.sellerOrganizationId ?? null,
      countryCode: input.countryCode ?? null,
      city: input.city ?? null,
      module: input.module,
      moduleEntityId: input.moduleEntityId,
      foodOrderId: input.module === "food_order" ? input.moduleEntityId : null,
      homeChefRequestId: input.module === "home_chef_request" ? input.moduleEntityId : null,
      billingSubscriptionId: input.module === "subscription" ? input.moduleEntityId : null,
      paymentOrderId: input.paymentOrderId ?? null,
      originalAmount: new Prisma.Decimal(input.originalAmount),
      discountAmount: new Prisma.Decimal(input.discountAmount),
      currencyCode: input.currencyCode ?? input.promotion.currencyCode ?? "USD",
      status: "applied",
      metadataJson: { reason: input.reason },
    },
  });
}

export async function applyPromotionToAmount(input: Parameters<typeof validatePromotionForCheckout>[0]) {
  const evaluation = await validatePromotionForCheckout(input);
  return {
    evaluation,
    payableAmount: evaluation ? evaluation.payableAmount : roundMoney(input.amount),
    discountAmount: evaluation ? evaluation.discountAmount : 0,
  };
}

export async function listCreditAccounts() {
  return prisma.platformCreditAccount.findMany({ orderBy: { updatedAt: "desc" }, include: { ledgerEntries: { orderBy: { createdAt: "desc" }, take: 5 } }, take: 200 });
}

export async function grantPlatformCredit(session: AdminSession, input: unknown) {
  assertPromotionManager(session);
  const parsed = creditGrantSchema.parse(input);
  if (!parsed.organizationId && !parsed.userId) throw new Error("Choose a user or organization before granting credit.");
  const amount = roundMoney(parsed.amount);
  const account = await prisma.platformCreditAccount.upsert({
    where: parsed.organizationId
      ? { organizationId_currencyCode: { organizationId: parsed.organizationId, currencyCode: parsed.currencyCode } }
      : { userId_currencyCode: { userId: parsed.userId as string, currencyCode: parsed.currencyCode } },
    update: { status: "active" },
    create: {
      organizationId: parsed.organizationId || null,
      userId: parsed.userId || null,
      currencyCode: parsed.currencyCode,
      status: "active",
    },
  });
  const balanceAfter = roundMoney(Number(account.balanceAmount) + amount);
  const updated = await prisma.platformCreditAccount.update({
    where: { id: account.id },
    data: {
      balanceAmount: new Prisma.Decimal(balanceAfter),
      ledgerEntries: {
        create: {
          entryType: "grant",
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(balanceAfter),
          reason: parsed.reason || "Platform credit grant",
          createdById: session.user.id,
        },
      },
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: parsed.organizationId || null,
    action: "platform_credit.granted",
    targetType: "platform_credit_account",
    targetId: updated.id,
    details: { amount, currencyCode: parsed.currencyCode },
  });
  return updated;
}

export async function listReferralCodes() {
  return prisma.referralCode.findMany({ orderBy: { createdAt: "desc" }, include: { events: { orderBy: { createdAt: "desc" }, take: 10 } }, take: 200 });
}

export async function createReferralCode(session: AdminSession, input: unknown) {
  assertPromotionManager(session);
  const parsed = referralCodeSchema.parse(input);
  const code = await prisma.referralCode.create({
    data: {
      code: normalizePromotionCode(parsed.code),
      ownerUserId: parsed.ownerUserId,
      ownerOrganizationId: parsed.ownerOrganizationId || null,
      countryCode: parsed.countryCode || null,
      city: parsed.city || null,
      usageLimit: parsed.usageLimit === "" ? null : parsed.usageLimit,
      rewardCreditAmount: parsed.rewardCreditAmount == null ? null : new Prisma.Decimal(parsed.rewardCreditAmount),
      rewardCurrencyCode: parsed.rewardCurrencyCode || null,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: parsed.ownerOrganizationId || null,
    countryCode: parsed.countryCode || null,
    action: "referral_code.created",
    targetType: "referral_code",
    targetId: code.id,
    details: { code: code.code },
  });
  return code;
}

function promotionDataFromInput(parsed: z.infer<typeof basePromotionSchema>, userId: string): Prisma.PromotionCreateInput {
  validateDiscountShape(parsed);
  return {
    code: normalizePromotionCode(parsed.code),
    name: parsed.name,
    description: parsed.description || null,
    promotionType: parsed.promotionType,
    discountType: parsed.discountType,
    status: parsed.status,
    scope: parsed.scope,
    sellerOrganization: parsed.sellerOrganizationId ? { connect: { id: parsed.sellerOrganizationId } } : undefined,
    countryCode: parsed.countryCode || null,
    region: parsed.region || null,
    city: parsed.city || null,
    currencyCode: parsed.currencyCode || null,
    percentOff: parsed.percentOff == null ? null : new Prisma.Decimal(parsed.percentOff),
    amountOff: parsed.amountOff == null ? null : new Prisma.Decimal(parsed.amountOff),
    minOrderAmount: parsed.minOrderAmount == null ? null : new Prisma.Decimal(parsed.minOrderAmount),
    maxDiscountAmount: parsed.maxDiscountAmount == null ? null : new Prisma.Decimal(parsed.maxDiscountAmount),
    startsAt: parsed.startsAt ?? null,
    endsAt: parsed.endsAt ?? null,
    usageLimit: parsed.usageLimit === "" ? null : parsed.usageLimit ?? null,
    perUserLimit: parsed.perUserLimit === "" ? null : parsed.perUserLimit ?? null,
    appliesToFoodOrders: parsed.appliesToFoodOrders,
    appliesToHomeChefRequests: parsed.appliesToHomeChefRequests,
    appliesToSubscriptions: parsed.appliesToSubscriptions,
    createdBy: { connect: { id: userId } },
  };
}

function validateDiscountShape(parsed: z.infer<typeof basePromotionSchema>) {
  if (parsed.discountType === "percent" && (!parsed.percentOff || parsed.percentOff <= 0 || parsed.percentOff > 100)) {
    throw new Error("Percent promotions require a percent between 0 and 100.");
  }
  if ((parsed.discountType === "fixed_amount" || parsed.discountType === "credit_amount") && (!parsed.amountOff || parsed.amountOff <= 0)) {
    throw new Error("Fixed amount and credit promotions require an amount.");
  }
}

function calculatePromotionDiscount(promotion: Promotion, amount: number) {
  let discount = 0;
  if (promotion.discountType === "percent") {
    discount = roundMoney(amount * (Number(promotion.percentOff ?? 0) / 100));
  } else if (promotion.discountType === "fixed_amount" || promotion.discountType === "credit_amount") {
    discount = Number(promotion.amountOff ?? 0);
  } else if (promotion.discountType === "free_delivery") {
    discount = Number(promotion.maxDiscountAmount ?? promotion.amountOff ?? 0);
  }
  if (promotion.maxDiscountAmount) discount = Math.min(discount, Number(promotion.maxDiscountAmount));
  return roundMoney(Math.min(discount, amount));
}

function promotionAppliesToModule(promotion: Promotion, module: PromotionModule) {
  if (module === "food_order") return promotion.appliesToFoodOrders;
  if (module === "home_chef_request") return promotion.appliesToHomeChefRequests;
  if (module === "subscription") return promotion.appliesToSubscriptions;
  return false;
}

function countryScopedWhere(session: AdminSession): Prisma.PromotionWhereInput {
  if (session.user.platformRole === "country_manager") {
    const countries = session.countryAssignments?.map((assignment) => assignment.countryCode) ?? [];
    return { OR: [{ countryCode: null }, { countryCode: { in: countries } }] };
  }
  return {};
}

function assertPromotionManager(session: AdminSession) {
  if (session.user.platformRole !== "platform_owner" && session.user.platformRole !== "platform_admin") {
    throw new Error("Platform promotion management requires platform owner/admin access.");
  }
}

function assertSellerCanManagePromotions(session: SellerSession) {
  if (session.activeOrganization.organizationType !== "home_catering" && session.activeOrganization.organizationType !== "restaurant") {
    throw new Error("Seller promotions are available for home catering and restaurant organizations.");
  }
}

function normalizeLocation(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
