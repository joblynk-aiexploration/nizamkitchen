import {
  EmailSuppressionReason,
  EmailTemplateCategory,
  EmailTemplateStatus,
  type PlatformRole,
  type Prisma,
  type UserStatus,
} from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { ENTERPRISE_EMAIL_TEMPLATES } from "./email-events";
import { renderEmailTemplateContent, seedToTemplateLike } from "./email-renderer";

type AdminSession = {
  user: { id: string; status: UserStatus; platformRole: PlatformRole | null };
};

const VIEW_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin", "auditor"];
const MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export function assertCanViewEmailCenter(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);
}

export function assertCanManageEmailCenter(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
}

export function assertCanManageSystemTemplates(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, ["platform_owner"]);
}

export async function listEmailTemplates(session: AdminSession) {
  assertCanViewEmailCenter(session);
  return prisma.emailTemplate.findMany({
    include: { variables: true, _count: { select: { variables: true } } },
    orderBy: [{ category: "asc" }, { templateKey: "asc" }, { version: "desc" }],
  });
}

export async function getEmailTemplateForAdmin(session: AdminSession, id: string) {
  assertCanViewEmailCenter(session);
  return prisma.emailTemplate.findUnique({
    where: { id },
    include: { variables: true, createdBy: { select: { email: true, fullName: true } }, updatedBy: { select: { email: true, fullName: true } } },
  });
}

export async function listEmailLogs(session: AdminSession, take = 200) {
  assertCanViewEmailCenter(session);
  return prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { email: true, fullName: true } }, organization: { select: { name: true } } },
  });
}

export async function listEmailPreferences(session: AdminSession, take = 200) {
  assertCanViewEmailCenter(session);
  return prisma.emailPreference.findMany({
    orderBy: { updatedAt: "desc" },
    take,
    include: { user: { select: { email: true, fullName: true } } },
  });
}

export async function listEmailSuppressions(session: AdminSession) {
  assertCanViewEmailCenter(session);
  return prisma.emailSuppression.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { email: true, fullName: true } } },
  });
}

export async function createEmailSuppression(session: AdminSession, input: {
  email: string;
  reason: EmailSuppressionReason;
  category?: EmailTemplateCategory | null;
}) {
  assertCanManageEmailCenter(session);
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.emailSuppression.findFirst({
    where: { email, category: input.category ?? null },
  });
  const suppression = existing
    ? await prisma.emailSuppression.update({
        where: { id: existing.id },
        data: {
          reason: input.reason,
          createdById: session.user.id,
        },
      })
    : await prisma.emailSuppression.create({
      data: {
      email: input.email.toLowerCase().trim(),
      reason: input.reason,
      category: input.category ?? null,
      createdById: session.user.id,
    },
    });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "email_suppression.created",
    targetType: "email_suppression",
    targetId: suppression.id,
    details: { email: maskEmail(input.email), category: input.category ?? "all" },
  });
  return suppression;
}

export async function archiveEmailTemplate(session: AdminSession, id: string) {
  const existing = await getEmailTemplateForAdmin(session, id);
  if (!existing) throw new Error("Email template not found.");
  if (existing.isSystem) assertCanManageSystemTemplates(session);
  else assertCanManageEmailCenter(session);

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: { status: EmailTemplateStatus.archived, updatedById: session.user.id },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "email_template.archived",
    targetType: "email_template",
    targetId: id,
  });
  return template;
}

export async function createEmailTemplate(session: AdminSession, input: {
  templateKey: string;
  name: string;
  description?: string | null;
  category: EmailTemplateCategory;
  subject: string;
  preheader?: string | null;
  htmlBody: string;
  textBody: string;
  locale?: string | null;
  countryCode?: string | null;
  status?: EmailTemplateStatus;
}) {
  assertCanManageEmailCenter(session);
  const version = await nextTemplateVersion(input.templateKey, input.locale, input.countryCode);
  const template = await prisma.emailTemplate.create({
    data: {
      templateKey: requiredText(input.templateKey, "Template key"),
      name: requiredText(input.name, "Template name"),
      description: optionalText(input.description),
      category: input.category,
      subject: requiredText(input.subject, "Subject"),
      preheader: optionalText(input.preheader),
      htmlBody: requiredText(input.htmlBody, "HTML body"),
      textBody: requiredText(input.textBody, "Text body"),
      locale: optionalText(input.locale),
      countryCode: optionalText(input.countryCode)?.toUpperCase() ?? null,
      status: input.status ?? EmailTemplateStatus.draft,
      version,
      isSystem: false,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "email_template.created",
    targetType: "email_template",
    targetId: template.id,
    details: { templateKey: template.templateKey, version: template.version },
  });
  return template;
}

export async function updateEmailTemplateDraft(session: AdminSession, id: string, input: {
  name: string;
  description?: string | null;
  subject: string;
  preheader?: string | null;
  htmlBody: string;
  textBody: string;
  status: EmailTemplateStatus;
}) {
  const existing = await getEmailTemplateForAdmin(session, id);
  if (!existing) throw new Error("Email template not found.");
  if (existing.isSystem) assertCanManageSystemTemplates(session);
  else assertCanManageEmailCenter(session);
  if (existing.status === EmailTemplateStatus.active) {
    throw new Error("Active email templates cannot be silently overwritten. Create a new version instead.");
  }

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: requiredText(input.name, "Template name"),
      description: optionalText(input.description),
      subject: requiredText(input.subject, "Subject"),
      preheader: optionalText(input.preheader),
      htmlBody: requiredText(input.htmlBody, "HTML body"),
      textBody: requiredText(input.textBody, "Text body"),
      status: input.status,
      updatedById: session.user.id,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "email_template.updated",
    targetType: "email_template",
    targetId: template.id,
  });
  return template;
}

export async function activateEmailTemplate(session: AdminSession, id: string) {
  const existing = await getEmailTemplateForAdmin(session, id);
  if (!existing) throw new Error("Email template not found.");
  if (existing.isSystem) assertCanManageSystemTemplates(session);
  else assertCanManageEmailCenter(session);

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: { status: EmailTemplateStatus.active, updatedById: session.user.id },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: "email_template.activated",
    targetType: "email_template",
    targetId: template.id,
  });
  return template;
}

export async function previewEmailTemplate(session: AdminSession, id: string) {
  const template = await getEmailTemplateForAdmin(session, id);
  if (!template) throw new Error("Email template not found.");
  const variables = Object.fromEntries(
    template.variables.map((variable) => [variable.variableKey, variable.exampleValue || sampleValue(variable.variableKey)]),
  );
  return renderEmailTemplateContent(template, { templateKey: template.templateKey, variables });
}

export async function getActiveEmailTemplate(input: {
  templateKey: string;
  locale?: string | null;
  countryCode?: string | null;
}) {
  const countryCode = input.countryCode?.toUpperCase() ?? null;
  const templates = await prisma.emailTemplate.findMany({
    where: {
      templateKey: input.templateKey,
      status: EmailTemplateStatus.active,
      OR: [
        { locale: input.locale ?? null, countryCode },
        { locale: null, countryCode },
        { locale: input.locale ?? null, countryCode: null },
        { locale: null, countryCode: null },
      ],
    },
    include: { variables: true },
    orderBy: [{ version: "desc" }],
  });

  const selected = templates.sort((left, right) => templateRank(right, input.locale, countryCode) - templateRank(left, input.locale, countryCode))[0];
  if (selected) return selected;

  const seed = ENTERPRISE_EMAIL_TEMPLATES.find((template) => template.templateKey === input.templateKey);
  if (!seed) return null;
  return {
    ...seedToTemplateLike(seed),
    id: `seed:${seed.templateKey}`,
    category: seed.category,
    variables: seed.variables ?? [],
    isSystem: true,
    version: 1,
  };
}

export async function seedEnterpriseEmailTemplates(createdById: string) {
  for (const seed of ENTERPRISE_EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { templateKey: seed.templateKey, locale: null, countryCode: null, version: 1 },
      include: { variables: true },
    });
    const body = seedToTemplateLike(seed);
    const templateData = {
      name: seed.name,
      description: seed.description ?? null,
      category: seed.category,
      subject: seed.subject,
      preheader: seed.preheader ?? null,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
      status: EmailTemplateStatus.active,
      isSystem: true,
      updatedById: createdById,
    };

    const template = existing
      ? await prisma.emailTemplate.update({ where: { id: existing.id }, data: templateData })
      : await prisma.emailTemplate.create({
          data: {
            ...templateData,
            templateKey: seed.templateKey,
            version: 1,
            createdById,
          },
        });

    for (const variable of seed.variables ?? []) {
      await prisma.emailTemplateVariable.upsert({
        where: { templateId_variableKey: { templateId: template.id, variableKey: variable.key } },
        update: {
          description: variable.description ?? null,
          exampleValue: variable.example ?? null,
          isRequired: variable.required ?? false,
        },
        create: {
          templateId: template.id,
          variableKey: variable.key,
          description: variable.description ?? null,
          exampleValue: variable.example ?? null,
          isRequired: variable.required ?? false,
        },
      });
    }
  }
}

export function emailCategoryLabel(category: EmailTemplateCategory | string) {
  return String(category).replace(/_/g, " ");
}

function templateRank(template: { locale?: string | null; countryCode?: string | null }, locale?: string | null, countryCode?: string | null) {
  let score = 0;
  if (countryCode && template.countryCode === countryCode) score += 4;
  if (locale && template.locale === locale) score += 2;
  if (!template.countryCode) score += 1;
  return score;
}

async function nextTemplateVersion(templateKey: string, locale?: string | null, countryCode?: string | null) {
  const latest = await prisma.emailTemplate.findFirst({
    where: {
      templateKey,
      locale: optionalText(locale),
      countryCode: optionalText(countryCode)?.toUpperCase() ?? null,
    },
    orderBy: { version: "desc" },
  });
  return (latest?.version ?? 0) + 1;
}

function requiredText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function sampleValue(key: string) {
  const samples: Record<string, string> = {
    appName: "NizamKitchen",
    userName: "Aisha Khan",
    userEmail: "aisha@example.com",
    organizationName: "Nizam Family Kitchen",
    dashboardUrl: "https://nk.friscodawah.org/dashboard",
    orderNumber: "NK-10025",
    sellerName: "Nizam Home Catering",
    customerName: "Nizam Family Kitchen",
    requestTitle: "Friday biryani dinner",
    ticketNumber: "TKT-1001",
    ticketTitle: "Order question",
    paymentAmount: "59.99",
    currencyCode: "USD",
    rejectionReason: "Document is expired",
  };
  return samples[key] ?? "";
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "masked";
  return `${name.slice(0, 2)}***@${domain}`;
}

export function toJsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value ? JSON.parse(JSON.stringify(value)) : undefined;
}
