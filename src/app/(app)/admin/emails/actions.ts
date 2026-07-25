"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmailSuppressionReason, EmailTemplateCategory, EmailTemplateStatus } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  activateEmailTemplate,
  archiveEmailTemplate,
  createEmailSuppression,
  createEmailTemplate,
  updateEmailTemplateDraft,
} from "@/server/email/email-template-service";
import { sendAllSystemTemplateTestEmails, sendTemplateEmail } from "@/server/email/email-service";

function formText(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() ?? "";
}

function optionalText(formData: FormData, key: string) {
  const value = formText(formData, key);
  return value || null;
}

function redirectWithMessage(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`);
}

export async function createEmailTemplateAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const template = await createEmailTemplate(session, {
      templateKey: formText(formData, "templateKey"),
      name: formText(formData, "name"),
      description: optionalText(formData, "description"),
      category: formText(formData, "category") as EmailTemplateCategory,
      subject: formText(formData, "subject"),
      preheader: optionalText(formData, "preheader"),
      htmlBody: formText(formData, "htmlBody"),
      textBody: formText(formData, "textBody"),
      locale: optionalText(formData, "locale"),
      countryCode: optionalText(formData, "countryCode"),
      status: formText(formData, "status") as EmailTemplateStatus,
    });
    revalidatePath("/admin/emails");
    revalidatePath("/admin/emails/templates");
    redirectWithMessage(`/admin/emails/templates/${template.id}`, "Successfully saved email template.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/emails/templates/new", getActionErrorMessage(error, "Unable to save email template."));
  }
}

export async function updateEmailTemplateAction(formData: FormData) {
  const id = formText(formData, "id");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    await updateEmailTemplateDraft(session, id, {
      name: formText(formData, "name"),
      description: optionalText(formData, "description"),
      subject: formText(formData, "subject"),
      preheader: optionalText(formData, "preheader"),
      htmlBody: formText(formData, "htmlBody"),
      textBody: formText(formData, "textBody"),
      status: formText(formData, "status") as EmailTemplateStatus,
    });
    revalidatePath("/admin/emails/templates");
    revalidatePath(`/admin/emails/templates/${id}`);
    redirectWithMessage(`/admin/emails/templates/${id}`, "Successfully saved email template.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage(`/admin/emails/templates/${id}`, getActionErrorMessage(error, "Unable to save email template."));
  }
}

export async function activateEmailTemplateAction(formData: FormData) {
  const id = formText(formData, "id");
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  await activateEmailTemplate(session, id);
  revalidatePath("/admin/emails/templates");
  revalidatePath(`/admin/emails/templates/${id}`);
  redirectWithMessage(`/admin/emails/templates/${id}`, "Email template is active.");
}

export async function archiveEmailTemplateAction(formData: FormData) {
  const id = formText(formData, "id");
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  await archiveEmailTemplate(session, id);
  revalidatePath("/admin/emails/templates");
  revalidatePath(`/admin/emails/templates/${id}`);
  redirectWithMessage(`/admin/emails/templates/${id}`, "Email template was archived.");
}

export async function createEmailSuppressionAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    await createEmailSuppression(session, {
      email: formText(formData, "email"),
      reason: formText(formData, "reason") as EmailSuppressionReason,
      category: optionalText(formData, "category") as EmailTemplateCategory | null,
    });
    revalidatePath("/admin/emails/suppressions");
    redirectWithMessage("/admin/emails/suppressions", "Successfully saved email suppression.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/emails/suppressions", getActionErrorMessage(error, "Unable to save suppression."));
  }
}

export async function sendTestEmailAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    await sendTemplateEmail({
      to: formText(formData, "recipientEmail"),
      templateKey: formText(formData, "templateKey"),
      recipientUserId: session.user.id,
      countryCode: optionalText(formData, "countryCode"),
      variables: {
        userName: session.user.fullName ?? "Platform Owner",
        userEmail: session.user.email,
        organizationName: "NizamKitchen",
        orderNumber: "NK-TEST-1001",
        sellerName: "Nizam Home Catering",
        customerName: "Nizam Family Kitchen",
        requestTitle: "Test home chef request",
        ticketNumber: "TKT-TEST",
        ticketTitle: "Test support ticket",
        paymentAmount: "59.99",
        totalAmount: "59.99",
        currencyCode: "USD",
        dashboardUrl: "/admin/emails",
      },
      metadata: { source: "admin_test_send" },
      idempotencyKey: `test:${session.user.id}:${Date.now()}`,
    });
    revalidatePath("/admin/emails/logs");
    redirectWithMessage("/admin/emails/test-send", "Test email request was processed. Check email logs for delivery status.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/emails/test-send", getActionErrorMessage(error, "Unable to send test email."));
  }
}

export async function sendAllTestEmailsAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner"]);
    const result = await sendAllSystemTemplateTestEmails({
      requestedById: session.user.id,
      recipientEmail: formText(formData, "recipientEmail") || "learnasurah@gmail.com",
      countryCode: optionalText(formData, "countryCode"),
    });
    revalidatePath("/admin/emails");
    revalidatePath("/admin/emails/logs");
    revalidatePath("/admin/emails/test-send");
    redirectWithMessage(
      "/admin/emails/test-send",
      `Test email batch processed for ${result.recipientEmail}: ${result.sent} sent, ${result.skipped} skipped/logged across ${result.total} templates.`,
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithMessage("/admin/emails/test-send", getActionErrorMessage(error, "Unable to send all test emails."));
  }
}
