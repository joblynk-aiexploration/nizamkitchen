import type { getCurrentSession } from "@/lib/session";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_APP_TIME_ZONE } from "@/lib/timezones";
import { systemSettingUpdateSchema } from "@/lib/validation/admin";
import { recordAdminAuditLog } from "@/server/audit/audit-service";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

const SYSTEM_SETTING_DEFAULTS = [
  {
    key: "platform.name",
    label: "Platform name",
    value: "NizamKitchen",
    description: "Public platform name shown across admin and product experiences.",
  },
  {
    key: "platform.support_email",
    label: "Support email",
    value: "help@nizamkitchen.dev",
    description: "Primary support inbox for operational workflows.",
  },
  {
    key: "platform.default_country",
    label: "Default country",
    value: "US",
    description: "Default onboarding country placeholder.",
  },
  {
    key: "platform.default_currency",
    label: "Default currency",
    value: "USD",
    description: "Default platform currency placeholder.",
  },
  {
    key: "platform.default_locale",
    label: "Default locale",
    value: "en-US",
    description: "Default locale placeholder.",
  },
  {
    key: "platform.default_timezone",
    label: "Default timezone",
    value: DEFAULT_APP_TIME_ZONE,
    description: "Default timezone placeholder.",
  },
  {
    key: "platform.registration_enabled",
    label: "Registration enabled",
    value: "true",
    description: "Controls whether self-serve registration is open.",
  },
  {
    key: "platform.invite_only_mode",
    label: "Invite-only mode",
    value: "false",
    description: "Placeholder for future invite-only operation.",
  },
  {
    key: "platform.maintenance_mode",
    label: "Maintenance mode",
    value: "false",
    description: "Placeholder maintenance toggle.",
  },
  {
    key: "platform.default_measurement_system",
    label: "Default measurement system",
    value: "metric",
    description: "Global measurement default.",
  },
  {
    key: "limits.max_organizations_per_user",
    label: "Max organizations per user",
    value: "10",
    description: "Placeholder soft cap for user-owned organizations.",
  },
  {
    key: "limits.max_members_per_organization",
    label: "Max members per organization",
    value: "100",
    description: "Placeholder soft cap for tenant membership counts.",
  },
  {
    key: "invoice.company_display_name",
    label: "Invoice company display name",
    value: "NizamKitchen",
    description: "Brand name shown on invoice previews, print views, and PDF downloads.",
  },
  {
    key: "invoice.company_legal_name",
    label: "Invoice legal company name",
    value: "NizamKitchen",
    description: "Legal entity or marketplace operator name shown in the invoice From section.",
  },
  {
    key: "invoice.billing_address",
    label: "Invoice billing address",
    value: "Frisco, Texas\nUnited States",
    description: "Line-separated billing address shown on invoices.",
  },
  {
    key: "invoice.billing_email",
    label: "Invoice billing email",
    value: "billing@nizamkitchen.dev",
    description: "Billing contact email shown on invoices and receipts.",
  },
  {
    key: "invoice.support_phone",
    label: "Invoice support phone",
    value: "",
    description: "Optional support phone shown on invoices when configured.",
  },
  {
    key: "invoice.website",
    label: "Invoice website",
    value: "https://nk.friscodawah.org",
    description: "Public website URL shown in invoice footer and header.",
  },
  {
    key: "invoice.tax_id",
    label: "Invoice tax ID",
    value: "",
    description: "Optional tax or business ID shown only when configured.",
  },
  {
    key: "invoice.accent_color",
    label: "Invoice accent color",
    value: "#0f766e",
    description: "Brand accent color used in generated invoice PDFs.",
  },
  {
    key: "invoice.default_notes",
    label: "Invoice default notes",
    value: "Thank you for using NizamKitchen. This document was generated from a secure payment and accounting record.",
    description: "Default customer-facing note shown on invoice previews and PDFs.",
  },
  {
    key: "invoice.payment_terms",
    label: "Invoice payment terms",
    value: "Due on receipt unless otherwise stated.",
    description: "Default payment terms shown on invoice previews and PDFs.",
  },
  {
    key: "invoice.footer_text",
    label: "Invoice footer text",
    value: "This invoice was generated electronically and does not require a signature.",
    description: "Legal footer text shown on invoice previews and PDFs.",
  },
  {
    key: "invoice.show_zero_discount_row",
    label: "Show zero discount row",
    value: "true",
    description: "Controls whether invoices show a discount row when the discount amount is zero.",
  },
  {
    key: "invoice.show_provider_row",
    label: "Show provider row",
    value: "true",
    description: "Controls whether invoices show payment provider details.",
  },
] as const;

export async function listAdminSystemSettings() {
  const rows = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return SYSTEM_SETTING_DEFAULTS.map((preset) => {
    const existing = rows.find((row) => row.key === preset.key);

    return {
      key: preset.key,
      label: preset.label,
      value: existing ? stringifyValue(existing.value) : preset.value,
      description: existing?.description ?? preset.description,
      id: existing?.id ?? preset.key,
    };
  });
}

export async function updateSystemSetting(session: Session, input: unknown) {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
  const parsed = systemSettingUpdateSchema.parse(input);

  const setting = await prisma.systemSetting.upsert({
    where: { key: parsed.key },
    update: {
      value: parsed.value,
      description: parsed.description,
    },
    create: {
      key: parsed.key,
      value: parsed.value,
      description: parsed.description,
    },
  });

  await recordAdminAuditLog({
    actorUserId: session.user.id,
    action: "setting.updated",
    targetType: "system_setting",
    targetId: parsed.key,
    details: parsed,
  });

  return setting;
}

function stringifyValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}
