import type { getCurrentSession } from "@/lib/session";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    value: "support@nizamkitchen.dev",
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
    value: "America/Chicago",
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
