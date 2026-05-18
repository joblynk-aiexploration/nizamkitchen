import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type EmailTemplateKey =
  | "home_chef_request_submitted"
  | "home_chef_request_status_updated"
  | "home_chef_new_message"
  | "chef_profile_approved"
  | "chef_profile_suspended"
  | "grocery_list_shared";

type EmailInput = {
  to: string;
  templateKey: EmailTemplateKey;
  subject: string;
  body: string;
  organizationId?: string | null;
  userId?: string | null;
  countryCode?: string | null;
  metadata?: Record<string, unknown>;
};

export function renderEmailTemplate(templateKey: EmailTemplateKey, data: Record<string, string | null | undefined>) {
  const appName = "NizamKitchen";
  const title = data.title ?? "NizamKitchen update";
  const actionUrl = data.actionUrl;

  const subjects: Record<EmailTemplateKey, string> = {
    home_chef_request_submitted: "Your home chef request was submitted",
    home_chef_request_status_updated: "Your home chef request status changed",
    home_chef_new_message: "New message on your home chef request",
    chef_profile_approved: "Your chef profile was approved",
    chef_profile_suspended: "Your chef profile needs attention",
    grocery_list_shared: "A grocery list was shared",
  };

  return {
    subject: subjects[templateKey],
    body: [
      `${appName}`,
      "",
      title,
      "",
      data.body ?? "There is a new update in your workspace.",
      actionUrl ? "" : null,
      actionUrl ? `Open: ${actionUrl}` : null,
      "",
      "This is an operational notification from NizamKitchen.",
    ].filter(Boolean).join("\n"),
  };
}

export async function sendEmail(input: EmailInput) {
  const smtpConfigured = Boolean(env.SMTP_HOST && env.EMAIL_FROM);

  if (!smtpConfigured) {
    if (env.NODE_ENV !== "production") {
      console.info("[email-placeholder] SMTP is not configured; email was not sent.", {
        templateKey: input.templateKey,
        to: input.to,
      });
    }
    await recordEmailLog(input, "skipped_no_smtp");
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  // SMTP transport wiring is intentionally abstracted for deployment-specific providers.
  if (env.NODE_ENV !== "production") {
    console.info("[email-placeholder] SMTP provider placeholder recorded.", {
      templateKey: input.templateKey,
      to: input.to,
      host: env.SMTP_HOST,
    });
  }
  await recordEmailLog(input, "placeholder");
  return { sent: false, reason: "provider_placeholder" as const };
}

async function recordEmailLog(input: EmailInput, deliveryStatus: string) {
  return prisma.emailLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      countryCode: input.countryCode ?? null,
      templateKey: input.templateKey,
      recipientEmail: input.to,
      deliveryStatus,
      metadata: {
        subject: input.subject,
        bodyPreview: input.body.slice(0, 280),
        ...(input.metadata ?? {}),
      },
    },
  });
}
