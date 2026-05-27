import { env } from "@/lib/env";
import { ENTERPRISE_EMAIL_TEMPLATES } from "./email-events";
import type { EmailRenderInput, RenderedEmail } from "./email-types";

type TemplateLike = {
  templateKey: string;
  subject: string;
  preheader?: string | null;
  htmlBody: string;
  textBody: string;
};

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function renderEmailTemplateContent(template: TemplateLike, input: EmailRenderInput): RenderedEmail {
  const variables = withDefaultVariables(input.variables);
  const missingVariables = new Set<string>();
  const replace = (source: string) =>
    source.replace(VARIABLE_PATTERN, (_match, key: string) => {
      const value = variables[key];
      if (value === undefined || value === null || value === "") {
        missingVariables.add(key);
        return "";
      }
      return String(value);
    });

  const subject = replace(template.subject).trim() || "NizamKitchen update";
  const preheader = template.preheader ? replace(template.preheader).trim() : null;
  const bodyHtml = replace(template.htmlBody);
  const bodyText = replace(template.textBody);
  const actionUrl = stringValue(variables.primaryActionUrl);
  const actionLabel = stringValue(variables.primaryActionLabel) || "View details";
  const securityContext = buildSecurityContext(template.templateKey, variables) ?? undefined;

  return {
    subject,
    preheader,
    html: buildEmailHtml({
      title: subject,
      preheader,
      bodyHtml,
      actionUrl,
      actionLabel,
      securityContext,
      variables,
    }),
    text: buildEmailText({
      subject,
      preheader,
      bodyText,
      actionUrl,
      actionLabel,
      securityContext,
      variables,
    }),
    missingVariables: [...missingVariables],
  };
}

export function renderSeedTemplate(templateKey: string, variables: Record<string, unknown> = {}) {
  const seed = ENTERPRISE_EMAIL_TEMPLATES.find((template) => template.templateKey === templateKey);
  if (!seed) {
    throw new Error(`Unknown email template: ${templateKey}`);
  }

  return renderEmailTemplateContent(seedToTemplateLike(seed), {
    templateKey,
    variables: {
      ...variables,
      primaryActionLabel: seed.ctaLabel,
      primaryActionUrl: seed.ctaUrlVariable ? variables[seed.ctaUrlVariable] : variables.dashboardUrl,
    },
  });
}

export function seedToTemplateLike(seed: {
  templateKey: string;
  subject: string;
  preheader?: string | null;
  body: string;
}) {
  return {
    templateKey: seed.templateKey,
    subject: seed.subject,
    preheader: seed.preheader ?? null,
    htmlBody: plainTextToEmailHtml(seed.body),
    textBody: seed.body,
  };
}

export function plainTextToEmailHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px 0;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

function withDefaultVariables(variables: Record<string, unknown>): Record<string, unknown> {
  const appUrl = stringValue(variables.appUrl) || env.APP_URL || "http://localhost:3000";
  return {
    appName: "NizamKitchen",
    supportEmail: "support@nizamkitchen.dev",
    appUrl,
    dashboardUrl: new URL("/dashboard", appUrl).toString(),
    currentYear: new Date().getFullYear(),
    privacyUrl: new URL("/privacy", appUrl).toString(),
    termsUrl: new URL("/terms", appUrl).toString(),
    notificationPreferencesUrl: new URL("/settings/notifications", appUrl).toString(),
    ...variables,
  };
}

function buildEmailHtml({
  title,
  preheader,
  bodyHtml,
  actionUrl,
  actionLabel,
  securityContext,
  variables,
}: {
  title: string;
  preheader?: string | null;
  bodyHtml: string;
  actionUrl?: string;
  actionLabel: string;
  securityContext?: { title: string; body: string; fallbackUrl?: string | null };
  variables: Record<string, unknown>;
}) {
  const appName = escapeHtml(stringValue(variables.appName) || "NizamKitchen");
  const supportEmail = escapeHtml(stringValue(variables.supportEmail) || "support@nizamkitchen.dev");
  const privacyUrl = escapeAttribute(stringValue(variables.privacyUrl) || "/privacy");
  const termsUrl = escapeAttribute(stringValue(variables.termsUrl) || "/terms");
  const preferencesUrl = escapeAttribute(stringValue(variables.notificationPreferencesUrl) || "/settings/notifications");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#edf4f2;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader ?? "")}</div>
    <main style="width:100%;padding:28px 12px;">
      <section style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d8e3e0;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
        <header style="background:linear-gradient(135deg,#0f3f3b,#103148);padding:30px 32px;color:#ffffff;">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <span style="display:inline-flex;width:40px;height:40px;border-radius:14px;background:#d97745;color:#ffffff;align-items:center;justify-content:center;font-weight:800;line-height:40px;text-align:center;">NK</span>
            <span style="font-size:20px;font-weight:800;letter-spacing:0.01em;">${appName}</span>
          </div>
        </header>
        <article style="padding:34px 32px;">
          <p style="margin:0 0 10px 0;color:#0f766e;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">Account update</p>
          <h1 style="margin:0 0 20px 0;color:#172033;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;">${escapeHtml(title)}</h1>
          <div style="color:#475569;font-size:15px;line-height:1.7;">${bodyHtml}</div>
          ${actionUrl ? `<p style="margin:30px 0 0 0;"><a href="${escapeAttribute(actionUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:16px;padding:15px 24px;font-weight:800;box-shadow:0 10px 24px rgba(15,118,110,0.22);">${escapeHtml(actionLabel)}</a></p>` : ""}
          ${actionUrl ? `<p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">If the button does not open, copy and paste this secure link into your browser:<br /><a href="${escapeAttribute(actionUrl)}" style="color:#0f766e;word-break:break-all;">${escapeHtml(actionUrl)}</a></p>` : ""}
          ${securityContext ? `<div style="margin-top:26px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;padding:16px;color:#7c2d12;font-size:13px;line-height:1.6;">
            <strong style="display:block;margin-bottom:4px;color:#9a3412;">${escapeHtml(securityContext.title)}</strong>
            ${escapeHtml(securityContext.body)}
          </div>` : ""}
          <div style="margin-top:28px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;padding:16px;color:#64748b;font-size:13px;line-height:1.6;">
            You are receiving this email because it relates to your NizamKitchen account, workspace, order, support request, or notification preferences.
          </div>
        </article>
        <footer style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:22px 32px;color:#64748b;font-size:12px;line-height:1.7;">
          <strong style="color:#172033;">${appName}</strong><br />
          Need help? Contact ${supportEmail}.<br />
          <a href="${termsUrl}" style="color:#0f766e;">Terms</a> ·
          <a href="${privacyUrl}" style="color:#0f766e;">Privacy</a> ·
          <a href="${preferencesUrl}" style="color:#0f766e;">Notification preferences</a>
          <div style="margin-top:10px;">© ${escapeHtml(String(variables.currentYear ?? new Date().getFullYear()))} ${appName}. All rights reserved.</div>
        </footer>
      </section>
    </main>
  </body>
</html>`;
}

function buildEmailText({
  subject,
  preheader,
  bodyText,
  actionUrl,
  actionLabel,
  securityContext,
  variables,
}: {
  subject: string;
  preheader?: string | null;
  bodyText: string;
  actionUrl?: string;
  actionLabel: string;
  securityContext?: { title: string; body: string; fallbackUrl?: string | null };
  variables: Record<string, unknown>;
}) {
  return [
    stringValue(variables.appName) || "NizamKitchen",
    "",
    subject,
    preheader ? `\n${preheader}` : null,
    "",
    bodyText.trim(),
    actionUrl ? "" : null,
    actionUrl ? `${actionLabel}: ${actionUrl}` : null,
    actionUrl ? `If the button/link does not open, copy and paste this URL into your browser: ${actionUrl}` : null,
    securityContext ? "" : null,
    securityContext ? `${securityContext.title}: ${securityContext.body}` : null,
    "",
    "You are receiving this email because it relates to your NizamKitchen account or activity.",
    `Terms: ${stringValue(variables.termsUrl) || "/terms"}`,
    `Privacy: ${stringValue(variables.privacyUrl) || "/privacy"}`,
    `Notification preferences: ${stringValue(variables.notificationPreferencesUrl) || "/settings/notifications"}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSecurityContext(templateKey: string, variables: Record<string, unknown>) {
  if (templateKey !== "auth.password_reset") return null;
  const expiresInMinutes = stringValue(variables.expiresInMinutes) || "45";
  return {
    title: "Security note",
    body: `This password reset link expires in ${expiresInMinutes} minutes. NizamKitchen will never ask you to share this email, your password, or verification codes.`,
    fallbackUrl: stringValue(variables.resetUrl),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
