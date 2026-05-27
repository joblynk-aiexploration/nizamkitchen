import { EmailDeliveryStatus, EmailProvider, EmailTemplateCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderSeedTemplate } from "@/server/email/email-renderer";
import { sendTemplateEmail } from "@/server/email/email-service";

export type EmailTemplateKey =
  | "home_chef_request_submitted"
  | "home_chef_request_status_updated"
  | "home_chef_new_message"
  | "chef_profile_approved"
  | "chef_profile_suspended"
  | "grocery_list_shared"
  | "password_reset"
  | "support_ticket_created"
  | "support_ticket_reply"
  | "support_ticket_status_changed";

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

const TEMPLATE_KEY_MAP: Record<EmailTemplateKey, string> = {
  home_chef_request_submitted: "home_chef.request_submitted",
  home_chef_request_status_updated: "home_chef.request_under_review",
  home_chef_new_message: "home_chef.message_received",
  chef_profile_approved: "verification.approved",
  chef_profile_suspended: "verification.suspended",
  grocery_list_shared: "grocery_list.shared",
  password_reset: "auth.password_reset",
  support_ticket_created: "support.ticket_created",
  support_ticket_reply: "support.reply_received",
  support_ticket_status_changed: "support.status_changed",
};

export function renderEmailTemplate(templateKey: EmailTemplateKey, data: Record<string, string | null | undefined>) {
  const mappedKey = TEMPLATE_KEY_MAP[templateKey];
  const rendered = renderSeedTemplate(mappedKey, {
    ...data,
    userName: data.userName ?? "there",
    requestTitle: data.title,
    ticketTitle: data.title,
    dashboardUrl: data.actionUrl,
  });

  return {
    subject: rendered.subject,
    body: rendered.text,
  };
}

export async function sendEmail(input: EmailInput) {
  const mappedKey = TEMPLATE_KEY_MAP[input.templateKey];
  try {
    return await sendTemplateEmail({
      to: input.to,
      templateKey: mappedKey,
      recipientUserId: input.userId,
      organizationId: input.organizationId,
      countryCode: input.countryCode,
      variables: {
        userEmail: input.to,
        userName: input.metadata?.userName ?? "there",
        requestTitle: input.subject,
        ticketTitle: input.subject,
        primaryActionLabel: "View details",
        dashboardUrl: input.metadata?.actionUrl,
        ...(input.metadata ?? {}),
      },
      metadata: {
        legacyTemplateKey: input.templateKey,
        bodyPreview: input.body.slice(0, 280),
        ...(input.metadata ?? {}),
      },
    });
  } catch {
    const log = await prisma.emailLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        recipientUserId: input.userId ?? null,
        countryCode: input.countryCode ?? null,
        templateKey: mappedKey,
        recipientEmail: input.to,
        category: EmailTemplateCategory.notification,
        subject: input.subject,
        status: EmailDeliveryStatus.skipped,
        deliveryStatus: "skipped_no_smtp",
        provider: EmailProvider.disabled,
        metadata: {
          legacyTemplateKey: input.templateKey,
          bodyPreview: input.body.slice(0, 280),
          ...(input.metadata ?? {}),
        },
        metadataJson: {
          legacyTemplateKey: input.templateKey,
          ...(input.metadata ?? {}),
        },
      },
    });
    return { sent: false, reason: "smtp_not_configured" as const, logId: log.id };
  }
}
