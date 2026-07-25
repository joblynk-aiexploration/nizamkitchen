import {
  EmailDeliveryStatus,
  EmailProvider,
  EmailTemplateCategory,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ENTERPRISE_EMAIL_TEMPLATES, isMarketingTemplate, TRANSACTIONAL_EMAIL_CATEGORIES } from "./email-events";
import { renderEmailTemplateContent } from "./email-renderer";
import { getActiveEmailTemplate, toJsonValue } from "./email-template-service";
import type { SendEmailInput } from "./email-types";
import { resolveEmailProvider } from "./providers/smtp-provider";

const TEST_EMAIL_RECIPIENT = "learnasurah@gmail.com";
const BULK_TEST_EMAIL_CONCURRENCY = 6;

export async function sendTemplateEmail(input: SendEmailInput) {
  const template = await getActiveEmailTemplate(input);
  if (!template) {
    return recordSkipped(input, EmailTemplateCategory.notification, "Email template is not configured.");
  }

  const category = input.category ?? template.category ?? EmailTemplateCategory.notification;
  const duplicate = input.idempotencyKey ? await findDuplicate(input) : null;
  if (duplicate) {
    return { sent: false, reason: "duplicate" as const, logId: duplicate.id };
  }

  const suppression = await getSuppression(input.to, category);
  if (suppression) {
    const log = await recordLog(input, {
      category,
      subject: template.subject,
      status: EmailDeliveryStatus.suppressed,
      deliveryStatus: "suppressed",
      provider: EmailProvider.disabled,
      errorMessage: "Recipient is suppressed for this category.",
      metadata: { ...input.metadata, suppressionId: suppression.id, idempotencyKey: input.idempotencyKey },
    });
    return { sent: false, reason: "Recipient is suppressed for this category.", logId: log.id };
  }

  const preferenceResult = input.recipientUserId ? await emailPreferenceAllows(input.recipientUserId, category, template.templateKey) : { allowed: true };
  if (!preferenceResult.allowed) {
    const log = await recordLog(input, {
      category,
      subject: template.subject,
      status: EmailDeliveryStatus.skipped,
      deliveryStatus: "skipped_by_preference",
      provider: EmailProvider.disabled,
      errorMessage: preferenceResult.reason,
      metadata: { ...input.metadata, idempotencyKey: input.idempotencyKey },
    });
    return { sent: false, reason: preferenceResult.reason ?? "Email preference is disabled.", logId: log.id };
  }

  const rendered = renderEmailTemplateContent(template, {
    ...input,
    variables: {
      ...input.variables,
      primaryActionUrl: actionUrlFromVariables(input.variables),
      primaryActionLabel: input.variables.primaryActionLabel,
    },
  });
  const provider = await resolveEmailProvider(input.countryCode);
  const result = await provider.send({
    to: input.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    timeoutMs: input.deliveryTimeoutMs,
  });

  const status = result.sent
    ? EmailDeliveryStatus.sent
    : provider.provider === "disabled"
      ? EmailDeliveryStatus.skipped
      : EmailDeliveryStatus.failed;
  const deliveryStatus = result.sent ? "sent" : provider.provider === "disabled" ? "skipped_no_smtp" : "failed";

  const log = await recordLog(input, {
    category,
    subject: rendered.subject,
    status,
    deliveryStatus,
    provider: provider.provider === "smtp" ? EmailProvider.smtp : EmailProvider.disabled,
    providerMessageId: result.providerMessageId ?? null,
    errorMessage: result.errorMessage ?? null,
    sentAt: result.sent ? new Date() : null,
    metadata: {
      ...input.metadata,
      idempotencyKey: input.idempotencyKey,
      missingVariables: rendered.missingVariables,
      htmlPreview: rendered.html.slice(0, 280),
    },
  });

  return { sent: result.sent, logId: log.id, reason: result.errorMessage ?? null };
}

export async function sendAllSystemTemplateTestEmails(input: {
  requestedById: string;
  recipientEmail?: string;
  countryCode?: string | null;
}) {
  const recipientEmail = input.recipientEmail?.trim() || TEST_EMAIL_RECIPIENT;
  const batchId = `email-template-test:${input.requestedById}:${Date.now()}`;
  const results = await mapWithConcurrency(ENTERPRISE_EMAIL_TEMPLATES, BULK_TEST_EMAIL_CONCURRENCY, async (template) => {
    try {
      return await sendTemplateEmail({
        to: recipientEmail,
        templateKey: template.templateKey,
        countryCode: input.countryCode ?? null,
        variables: buildSystemTemplateTestVariables(template.templateKey),
        metadata: {
          source: "admin_all_template_test_send",
          requestedById: input.requestedById,
          batchId,
          templateName: template.name,
          templateCategory: template.category,
        },
        idempotencyKey: `${batchId}:${template.templateKey}`,
        deliveryTimeoutMs: 8_000,
      });
    } catch (error) {
      return {
        sent: false,
        reason: error instanceof Error ? error.message : "Template test send failed.",
        logId: null,
      };
    }
  });

  const sent = results.filter((result) => result.sent).length;
  const skipped = results.length - sent;
  return {
    batchId,
    recipientEmail,
    total: results.length,
    sent,
    skipped,
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    results.push(...await Promise.all(chunk.map((item) => mapper(item))));
  }
  return results;
}

export async function ensureEmailPreference(userId: string) {
  return prisma.emailPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function updateEmailPreference(userId: string, input: Partial<{
  transactionalEnabled: boolean;
  marketingEnabled: boolean;
  mealPlanningEmails: boolean;
  groceryEmails: boolean;
  orderEmails: boolean;
  homeChefEmails: boolean;
  sellerEmails: boolean;
  paymentEmails: boolean;
  verificationEmails: boolean;
  supportEmails: boolean;
  reviewEmails: boolean;
  promotionEmails: boolean;
  adminAlertEmails: boolean;
}>) {
  return prisma.emailPreference.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
}

async function emailPreferenceAllows(userId: string, category: EmailTemplateCategory, templateKey: string) {
  const preference = await ensureEmailPreference(userId);
  const transactional = TRANSACTIONAL_EMAIL_CATEGORIES.has(category);
  if (transactional) {
    return preference.transactionalEnabled
      ? { allowed: true }
      : { allowed: true, reason: "Transactional email was allowed for account safety." };
  }

  if (isMarketingTemplate(templateKey, category)) {
    return preference.marketingEnabled && preference.promotionEmails
      ? { allowed: true }
      : { allowed: false, reason: "Marketing email preference is disabled." };
  }

  const preferenceKey = categoryPreferenceKey(category);
  if (preferenceKey && preference[preferenceKey] === false) {
    return { allowed: false, reason: "Email preference is disabled for this category." };
  }

  return { allowed: true };
}

function categoryPreferenceKey(category: EmailTemplateCategory) {
  const map: Partial<Record<EmailTemplateCategory, keyof Awaited<ReturnType<typeof ensureEmailPreference>>>> = {
    meal_planning: "mealPlanningEmails",
    grocery: "groceryEmails",
    food_order: "orderEmails",
    home_chef: "homeChefEmails",
    chef_staff: "homeChefEmails",
    home_catering: "sellerEmails",
    restaurant: "sellerEmails",
    payment: "paymentEmails",
    billing: "paymentEmails",
    invoice: "paymentEmails",
    refund: "paymentEmails",
    payout: "paymentEmails",
    verification: "verificationEmails",
    support: "supportEmails",
    review: "reviewEmails",
    promotion: "promotionEmails",
    referral: "promotionEmails",
    admin_alert: "adminAlertEmails",
  };
  return map[category];
}

async function getSuppression(email: string, category: EmailTemplateCategory) {
  return prisma.emailSuppression.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      OR: [{ category: null }, { category }],
    },
  });
}

async function findDuplicate(input: SendEmailInput) {
  try {
    return prisma.emailLog.findFirst({
      where: {
        templateKey: input.templateKey,
        recipientEmail: input.to,
        metadataJson: { path: ["idempotencyKey"], equals: input.idempotencyKey },
      },
    });
  } catch {
    return null;
  }
}

async function recordSkipped(input: SendEmailInput, category: EmailTemplateCategory, errorMessage: string) {
  const log = await recordLog(input, {
    category,
    subject: "NizamKitchen update",
    status: EmailDeliveryStatus.skipped,
    deliveryStatus: "skipped_missing_template",
    provider: EmailProvider.disabled,
    errorMessage,
    metadata: input.metadata,
  });
  return { sent: false, reason: errorMessage, logId: log.id };
}

async function recordLog(input: SendEmailInput, data: {
  category: EmailTemplateCategory;
  subject: string;
  status: EmailDeliveryStatus;
  deliveryStatus: string;
  provider: EmailProvider;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.emailLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.recipientUserId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      countryCode: input.countryCode ?? null,
      templateKey: input.templateKey,
      recipientEmail: input.to,
      category: data.category,
      subject: data.subject,
      status: data.status,
      deliveryStatus: data.deliveryStatus,
      provider: data.provider,
      providerMessageId: data.providerMessageId ?? null,
      errorMessage: data.errorMessage ?? null,
      metadata: toJsonValue(data.metadata) as Prisma.InputJsonValue,
      metadataJson: toJsonValue(data.metadata) as Prisma.InputJsonValue,
      sentAt: data.sentAt ?? null,
    },
  });
}

function actionUrlFromVariables(variables: Record<string, unknown>) {
  const keys = [
    "primaryActionUrl",
    "orderUrl",
    "requestUrl",
    "receiptUrl",
    "invoiceUrl",
    "ticketUrl",
    "verificationUrl",
    "alertUrl",
    "shareUrl",
    "resetUrl",
    "verifyUrl",
    "dashboardUrl",
  ];
  for (const key of keys) {
    const value = variables[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function buildSystemTemplateTestVariables(templateKey: string): Record<string, unknown> {
  const appUrl = "https://nk.friscodawah.org";
  return {
    appName: "NizamKitchen",
    userName: "NizamKitchen Test Recipient",
    userEmail: TEST_EMAIL_RECIPIENT,
    organizationName: "Nizam Family Kitchen",
    supportEmail: "help@nizamkitchen.dev",
    appUrl,
    dashboardUrl: `${appUrl}/dashboard`,
    currentYear: new Date().getFullYear(),
    privacyUrl: `${appUrl}/privacy`,
    termsUrl: `${appUrl}/terms`,
    notificationPreferencesUrl: `${appUrl}/settings/notifications`,
    verifyUrl: `${appUrl}/api/auth/oauth/google/start`,
    resetUrl: `${appUrl}/reset-password?token=test-preview-token`,
    expiresInMinutes: "45",
    orderNumber: "NK-TEST-1001",
    orderStatus: "accepted",
    sellerName: "Nizam Home Catering",
    customerName: "Nizam Family Kitchen",
    orderUrl: `${appUrl}/orders/test-order`,
    requestedDate: "June 2, 2026 at 6:00 PM America/Chicago",
    fulfillmentType: "delivery",
    totalAmount: "59.99",
    currencyCode: "USD",
    requestTitle: "Friday Hyderabadi dinner",
    requestStatus: "scheduled",
    chefName: "Nizam Independent Home Chef",
    householdName: "Nizam Family Kitchen",
    requestUrl: `${appUrl}/home-chef/requests/test-request`,
    scheduledDate: "June 7, 2026 at 5:30 PM America/Chicago",
    quoteAmount: "180.00 USD",
    paymentAmount: "59.99",
    receiptUrl: `${appUrl}/billing/receipts/test-receipt`,
    invoiceUrl: `${appUrl}/billing/invoices/test-invoice`,
    paymentStatus: "paid",
    refundAmount: "15.00",
    documentName: "Food handler certificate",
    verificationStatus: "approved",
    rejectionReason: "The uploaded document is expired in this test scenario.",
    verificationUrl: `${appUrl}/catering/verification`,
    expiryDate: "July 31, 2026",
    ticketNumber: "TKT-TEST-1001",
    ticketTitle: "Template test support request",
    ticketStatus: "open",
    ticketUrl: `${appUrl}/support/tickets/test-ticket`,
    alertTitle: "Template test alert",
    alertSeverity: "warning",
    alertUrl: `${appUrl}/admin/system/alerts/test-alert`,
    integrationName: "SMTP",
    shareUrl: `${appUrl}/share/grocery-lists/test-share`,
    primaryActionLabel: actionLabelForTestTemplate(templateKey),
  };
}

function actionLabelForTestTemplate(templateKey: string) {
  if (templateKey.startsWith("auth.password")) return "Review account security";
  if (templateKey.startsWith("order.") || templateKey.includes(".order_")) return "View order";
  if (templateKey.startsWith("home_chef.") || templateKey.startsWith("chef_staff.")) return "View request";
  if (templateKey.startsWith("support.") || templateKey.startsWith("complaint.")) return "View ticket";
  if (templateKey.startsWith("verification.") || templateKey.includes("profile_")) return "View verification";
  if (templateKey.startsWith("invoice.")) return "View invoice";
  if (templateKey.startsWith("receipt.")) return "View receipt";
  if (templateKey.startsWith("admin.") || templateKey.startsWith("storage.configuration")) return "View alert";
  return "View details";
}
