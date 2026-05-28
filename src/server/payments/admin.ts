import { PaymentGatewayStatus, PaymentProvider, type PlatformRole, type Prisma, type UserStatus } from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { paginatedQuery } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { paymentConfigurationSchema, paymentGatewayCredentialSchema, paymentGatewaySchema } from "@/lib/validation/payments";
import { createAuditEvent } from "@/server/audit";
import { encryptGatewayCredential, isPaymentEncryptionConfigured, maskCredentialPreview } from "@/server/payments/credentials";
import { PaymentConfigurationError, PaymentPermissionError } from "@/server/payments/payment-errors";

type PaymentAdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

const PAYMENT_VIEW_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];
const PAYMENT_MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager"];
const PAYMENT_SECRET_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

function paymentCountryWhere(session: PaymentAdminSession, explicitCountryCode?: string) {
  assertPlatformRole(session.user.platformRole, PAYMENT_VIEW_ROLES);
  if (session.user.platformRole === "country_manager") {
    const assigned = session.countryAssignments.map((assignment) => assignment.countryCode);
    if (explicitCountryCode) assertCountryAccess(session, explicitCountryCode);
    return explicitCountryCode ? { countryCode: explicitCountryCode } : { countryCode: { in: assigned } };
  }
  return explicitCountryCode ? { countryCode: explicitCountryCode } : {};
}

function relatedPaymentOrderCountryWhere(session: PaymentAdminSession, explicitCountryCode?: string) {
  return { paymentOrder: paymentCountryWhere(session, explicitCountryCode) };
}

function relatedOrganizationCountryWhere(session: PaymentAdminSession, explicitCountryCode?: string) {
  return { organization: paymentCountryWhere(session, explicitCountryCode) };
}

function assertManagePaymentCountry(session: PaymentAdminSession, countryCode?: string | null) {
  assertPlatformRole(session.user.platformRole, PAYMENT_MANAGE_ROLES);
  if (session.user.platformRole === "country_manager") {
    if (!countryCode) throw new PaymentPermissionError("Country managers can only manage country-scoped payment records.");
    assertCountryAccess(session, countryCode);
  }
}

function assertSecretAccess(session: PaymentAdminSession) {
  assertPlatformRole(session.user.platformRole, PAYMENT_SECRET_ROLES);
}

export function paymentOperationalStatus() {
  return {
    encryptionConfigured: isPaymentEncryptionConfigured(),
    registeredProviders: Object.values(PaymentProvider),
    rawCardDataAllowed: false,
  };
}

export async function getPaymentsOverview(session: PaymentAdminSession) {
  assertPlatformRole(session.user.platformRole, PAYMENT_VIEW_ROLES);
  const where = paymentCountryWhere(session);
  const [gateways, configurations, orders, transactions, refunds, disputes, payouts, webhooks] = await Promise.all([
    prisma.paymentGateway.count({ where }),
    prisma.paymentConfiguration.count({ where }),
    prisma.paymentOrder.count({ where }),
    prisma.paymentTransaction.count({ where: relatedPaymentOrderCountryWhere(session) }),
    prisma.paymentRefund.count({ where: relatedPaymentOrderCountryWhere(session) }),
    prisma.paymentDispute.count({ where: relatedPaymentOrderCountryWhere(session) }),
    prisma.sellerPayout.count({ where: relatedOrganizationCountryWhere(session) }),
    prisma.paymentWebhookEvent.count(),
  ]);
  return { gateways, configurations, orders, transactions, refunds, disputes, payouts, webhooks, ...paymentOperationalStatus() };
}

export async function listPaymentGateways(session: PaymentAdminSession, filters: { countryCode?: string; status?: PaymentGatewayStatus } = {}) {
  const where: Prisma.PaymentGatewayWhereInput = {
    ...paymentCountryWhere(session, filters.countryCode),
    ...(filters.status ? { status: filters.status } : {}),
  };
  return prisma.paymentGateway.findMany({
    where,
    include: { credentials: { select: { id: true, keyName: true, valuePreview: true, rotatedAt: true, createdAt: true, updatedAt: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPaymentGateway(session: PaymentAdminSession, gatewayId: string) {
  assertPlatformRole(session.user.platformRole, PAYMENT_VIEW_ROLES);
  const gateway = await prisma.paymentGateway.findUnique({
    where: { id: gatewayId },
    include: { credentials: { select: { id: true, keyName: true, valuePreview: true, rotatedAt: true, createdAt: true, updatedAt: true } }, settings: true },
  });
  if (!gateway) throw new Error("Payment gateway not found.");
  if (session.user.platformRole === "country_manager" && gateway.countryCode) assertCountryAccess(session, gateway.countryCode);
  return gateway;
}

export async function savePaymentGateway(session: PaymentAdminSession, input: unknown) {
  const parsed = paymentGatewaySchema.parse(input);
  assertManagePaymentCountry(session, parsed.countryCode || null);
  const countries = parsed.supportedCountries.length ? parsed.supportedCountries : parsed.countryCode ? [parsed.countryCode] : [];
  const currencies = parsed.supportedCurrencies;
  const data = {
    provider: parsed.provider,
    displayName: parsed.displayName,
    status: parsed.status,
    environment: parsed.environment,
    countryCode: parsed.countryCode || null,
    supportedCountriesJson: countries,
    supportedCurrenciesJson: currencies,
    priority: parsed.priority,
    isDefault: parsed.isDefault,
    isPlatformGateway: parsed.isPlatformGateway,
  };
  const gateway = parsed.id
    ? await prisma.paymentGateway.update({ where: { id: parsed.id }, data })
    : await prisma.paymentGateway.create({ data });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: gateway.countryCode,
    action: parsed.id ? (gateway.status === PaymentGatewayStatus.disabled ? "payment_gateway.disabled" : "payment_gateway.updated") : "payment_gateway.created",
    targetType: "payment_gateway",
    targetId: gateway.id,
    details: { provider: gateway.provider, environment: gateway.environment, status: gateway.status },
  });
  return gateway;
}

export async function savePaymentGatewayCredential(session: PaymentAdminSession, input: unknown) {
  assertSecretAccess(session);
  if (!isPaymentEncryptionConfigured()) {
    throw new PaymentConfigurationError("ENCRYPTION_KEY is required before saving payment gateway credentials.");
  }
  const parsed = paymentGatewayCredentialSchema.parse(input);
  const gateway = await prisma.paymentGateway.findUnique({ where: { id: parsed.gatewayId } });
  if (!gateway) throw new Error("Payment gateway not found.");
  const encryptedValue = encryptGatewayCredential(parsed.secretValue);
  const valuePreview = maskCredentialPreview(parsed.secretValue);
  const existing = await prisma.paymentGatewayCredential.findUnique({
    where: { gatewayId_keyName: { gatewayId: parsed.gatewayId, keyName: parsed.keyName } },
  });
  const credential = existing
    ? await prisma.paymentGatewayCredential.update({
        where: { id: existing.id },
        data: { encryptedValue, valuePreview, updatedById: session.user.id, rotatedAt: new Date() },
      })
    : await prisma.paymentGatewayCredential.create({
        data: { gatewayId: parsed.gatewayId, keyName: parsed.keyName, encryptedValue, valuePreview, createdById: session.user.id },
      });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: gateway.countryCode,
    action: existing ? "payment_gateway.credentials_rotated" : "payment_gateway.credentials_updated",
    targetType: "payment_gateway",
    targetId: gateway.id,
    details: { keyName: parsed.keyName, valuePreview },
  });
  return { id: credential.id, keyName: credential.keyName, valuePreview: credential.valuePreview, rotatedAt: credential.rotatedAt };
}

export async function listPaymentConfigurations(session: PaymentAdminSession, countryCode?: string) {
  return prisma.paymentConfiguration.findMany({
    where: paymentCountryWhere(session, countryCode),
    orderBy: [{ countryCode: "asc" }, { currencyCode: "asc" }],
  });
}

export async function savePaymentConfiguration(session: PaymentAdminSession, input: unknown) {
  const parsed = paymentConfigurationSchema.parse(input);
  assertManagePaymentCountry(session, parsed.countryCode);
  const data = {
    currencyCode: parsed.currencyCode,
    defaultGatewayId: parsed.defaultGatewayId || null,
    allowStripe: parsed.allowStripe,
    allowPayPal: parsed.allowPayPal,
    allowGooglePay: parsed.allowGooglePay,
    allowManualPayment: parsed.allowManualPayment,
    platformCommissionPercent: parsed.platformCommissionPercent,
    fixedCommissionAmount: parsed.fixedCommissionAmount,
    taxPercent: parsed.taxPercent,
    status: parsed.status,
  };
  const configuration = await prisma.paymentConfiguration.upsert({
    where: { countryCode_currencyCode: { countryCode: parsed.countryCode, currencyCode: parsed.currencyCode } },
    update: data,
    create: { countryCode: parsed.countryCode, ...data },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: configuration.countryCode,
    action: "payment_configuration.updated",
    targetType: "payment_configuration",
    targetId: configuration.id,
    details: { currencyCode: configuration.currencyCode, status: configuration.status },
  });
  return configuration;
}

export async function listPaymentOrders(session: PaymentAdminSession, filters: { countryCode?: string; status?: string } = {}) {
  return prisma.paymentOrder.findMany({
    where: {
      ...paymentCountryWhere(session, filters.countryCode),
      ...(filters.status ? { status: filters.status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listPaymentOrdersPage(
  session: PaymentAdminSession,
  filters: { countryCode?: string; status?: string; page?: string | string[] | number; pageSize?: string | string[] | number } = {},
) {
  const where = {
    ...paymentCountryWhere(session, filters.countryCode),
    ...(filters.status ? { status: filters.status as never } : {}),
  };

  return paginatedQuery(
    prisma.paymentOrder.count({ where }),
    ({ skip, take }) =>
      prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    { page: filters.page, pageSize: filters.pageSize },
  );
}

export async function getPaymentOrder(session: PaymentAdminSession, orderId: string) {
  assertPlatformRole(session.user.platformRole, PAYMENT_VIEW_ROLES);
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
    include: { transactions: true, refunds: true, disputes: true },
  });
  if (!order) throw new Error("Payment order not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, order.countryCode);
  return order;
}

export async function listPaymentTransactions(session: PaymentAdminSession) {
  return prisma.paymentTransaction.findMany({ where: relatedPaymentOrderCountryWhere(session), orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listPaymentRefunds(session: PaymentAdminSession) {
  return prisma.paymentRefund.findMany({ where: relatedPaymentOrderCountryWhere(session), orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listPaymentDisputes(session: PaymentAdminSession) {
  return prisma.paymentDispute.findMany({ where: relatedPaymentOrderCountryWhere(session), orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listSellerPayouts(session: PaymentAdminSession) {
  return prisma.sellerPayout.findMany({ where: relatedOrganizationCountryWhere(session), orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listPaymentWebhookEvents(session: PaymentAdminSession) {
  assertPlatformRole(session.user.platformRole, PAYMENT_VIEW_ROLES);
  return prisma.paymentWebhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}
