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
      templateKey: template.templateKey,
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
  templateKey,
  title,
  preheader,
  bodyHtml,
  actionUrl,
  actionLabel,
  securityContext,
  variables,
}: {
  templateKey: string;
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
  const sectionLabel = escapeHtml(emailSectionLabel(templateKey));
  const safePreheader = escapeHtml(preheader || "A secure NizamKitchen communication is ready for review.");
  const safeActionUrl = actionUrl ? escapeAttribute(actionUrl) : "";
  const safeActionLabel = escapeHtml(actionLabel);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#eaf3f1;color:#172033;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#eaf3f1;">
      <tr>
        <td align="center" style="padding:34px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="680" style="width:100%;max-width:680px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #d7e3df;border-radius:28px;overflow:hidden;box-shadow:0 22px 60px rgba(15,23,42,0.13);">
            <tr>
              <td style="background:#0d3b38;background-image:linear-gradient(135deg,#092f2d 0%,#103b4b 55%,#14243b 100%);padding:0;color:#ffffff;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:14px 32px;border-bottom:1px solid rgba(255,255,255,0.12);color:#c8e7e1;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">
                      Secure enterprise communication
                    </td>
                    <td align="right" style="padding:14px 32px;border-bottom:1px solid rgba(255,255,255,0.12);color:#c8e7e1;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">
                      ${sectionLabel}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding:32px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                        <tr>
                          <td style="width:58px;vertical-align:middle;">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="50" height="50" style="border-collapse:separate;border-spacing:0;width:50px;height:50px;background:#d97745;border-radius:16px;box-shadow:0 12px 26px rgba(217,119,69,0.30);">
                              <tr>
                                <td align="center" valign="middle" style="width:50px;height:50px;text-align:center;vertical-align:middle;color:#ffffff;font-size:13px;font-weight:900;line-height:50px;letter-spacing:0;font-family:Arial,Helvetica,sans-serif;mso-line-height-rule:exactly;">NK</td>
                              </tr>
                            </table>
                          </td>
                          <td style="vertical-align:middle;padding-left:14px;">
                            <div style="font-size:23px;font-weight:900;line-height:1.15;letter-spacing:0;color:#ffffff;">${appName}</div>
                            <div style="margin-top:6px;color:#b7d7d1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Plan &bull; Cook &bull; Hire &bull; Order</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0;background:#ffffff;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:38px 36px 18px 36px;">
                      <div style="display:inline-block;background:#e6f6f2;border:1px solid #bde7de;border-radius:999px;padding:7px 11px;color:#0f766e;font-size:11px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;">${sectionLabel}</div>
                      <h1 style="margin:18px 0 18px 0;color:#172033;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.12;font-weight:800;">${escapeHtml(title)}</h1>
                      <div style="height:3px;width:54px;background:#d97745;border-radius:3px;margin:0 0 24px 0;"></div>
                      <div style="color:#40516a;font-size:15.5px;line-height:1.78;">${bodyHtml}</div>
                    </td>
                  </tr>
                  ${actionUrl ? `<tr>
                    <td style="padding:10px 36px 0 36px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;">
                        <tr>
                          <td bgcolor="#0f766e" style="border-radius:14px;background:#0f766e;box-shadow:0 12px 28px rgba(15,118,110,0.24);">
                            <a href="${safeActionUrl}" style="display:inline-block;padding:15px 25px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:900;line-height:1.2;border-radius:14px;">${safeActionLabel}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 36px 0 36px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f7fbfa;border:1px solid #dcebe7;border-radius:16px;">
                        <tr>
                          <td style="padding:15px 16px;color:#64748b;font-size:13px;line-height:1.65;">
                            <strong style="display:block;margin-bottom:4px;color:#334155;">Secure link fallback</strong>
                            If the button does not open, copy and paste this link into your browser:<br />
                            <a href="${safeActionUrl}" style="color:#0f766e;text-decoration:underline;word-break:break-all;">${escapeHtml(actionUrl)}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>` : ""}
                  ${securityContext ? `<tr>
                    <td style="padding:24px 36px 0 36px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;">
                        <tr>
                          <td style="padding:18px;color:#7c2d12;font-size:13px;line-height:1.65;">
                            <strong style="display:block;margin-bottom:5px;color:#9a3412;font-size:14px;">${escapeHtml(securityContext.title)}</strong>
                            ${escapeHtml(securityContext.body)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>` : ""}
                  <tr>
                    <td style="padding:28px 36px 38px 36px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;">
                        <tr>
                          <td style="padding:18px;color:#64748b;font-size:13px;line-height:1.65;">
                            <strong style="display:block;margin-bottom:4px;color:#334155;">Account and delivery notice</strong>
                            You are receiving this message because it relates to your NizamKitchen account, workspace, order, support request, or notification preferences.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:25px 36px;color:#64748b;font-size:12px;line-height:1.75;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                  <tr>
                    <td style="vertical-align:top;">
                      <strong style="color:#172033;font-size:13px;">${appName}</strong><br />
                      Enterprise Hyderabadi food marketplace operations for households, chefs, caterers, restaurants, and platform teams.
                    </td>
                  </tr>
                </table>
                <div style="margin-top:15px;padding-top:15px;border-top:1px solid #e2e8f0;">
                  Need help? Contact ${supportEmail}.<br />
                  <a href="${termsUrl}" style="color:#0f766e;text-decoration:underline;">Terms</a> &middot;
                  <a href="${privacyUrl}" style="color:#0f766e;text-decoration:underline;">Privacy</a> &middot;
                  <a href="${preferencesUrl}" style="color:#0f766e;text-decoration:underline;">Notification preferences</a>
                  <div style="margin-top:10px;">&copy; ${escapeHtml(String(variables.currentYear ?? new Date().getFullYear()))} ${appName}. All rights reserved.</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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

function emailSectionLabel(templateKey: string) {
  if (templateKey.startsWith("auth.")) return "Authentication";
  if (templateKey.startsWith("legal.") || templateKey.startsWith("privacy.")) return "Legal and privacy";
  if (templateKey.startsWith("meal_plan.")) return "Meal planning";
  if (templateKey.startsWith("grocery_list.")) return "Grocery";
  if (templateKey.startsWith("home_chef.") || templateKey.startsWith("chef_staff.")) return "Home chef";
  if (templateKey.startsWith("catering.")) return "Home catering";
  if (templateKey.startsWith("restaurant.")) return "Restaurant";
  if (templateKey.startsWith("order.")) return "Orders";
  if (templateKey.startsWith("payment.") || templateKey.startsWith("refund.") || templateKey.startsWith("payout.")) return "Payments";
  if (templateKey.startsWith("invoice.") || templateKey.startsWith("receipt.") || templateKey.startsWith("billing.")) return "Billing";
  if (templateKey.startsWith("verification.")) return "Verification";
  if (templateKey.startsWith("support.") || templateKey.startsWith("complaint.")) return "Support";
  if (templateKey.startsWith("review.")) return "Reviews";
  if (templateKey.startsWith("promotion.") || templateKey.startsWith("credit.") || templateKey.startsWith("referral.")) return "Promotions";
  if (templateKey.startsWith("admin.") || templateKey.startsWith("system.") || templateKey.startsWith("storage.")) return "Platform operations";
  return "Platform update";
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
