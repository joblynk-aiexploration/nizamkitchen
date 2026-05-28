import { Prisma, type PlatformRole, type SystemAlertSeverity, type SystemAlertStatus } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { logError, logEvent } from "@/server/observability/logger";

type AlertAdminSession = {
  user: { id?: string; platformRole: PlatformRole | null };
};

const ALERT_READ_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin", "auditor"];
const ALERT_MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin"];

export type CreateSystemAlertInput = {
  type: string;
  severity: SystemAlertSeverity;
  title: string;
  message: string;
  metadataJson?: Prisma.InputJsonValue;
};

export async function createSystemAlert(input: CreateSystemAlertInput) {
  try {
    const alert = await prisma.systemAlert.create({
      data: {
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: sanitizeMessage(input.message),
        metadataJson: sanitizeMetadata(input.metadataJson),
      },
    });

    logEvent(input.severity === "critical" ? "error" : "warn", input.title, {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
    });

    return alert;
  } catch (error) {
    logError("Unable to create system alert", error, { alertType: input.type });
    return null;
  }
}

export async function createSystemAlertForFailure(input: {
  type: string;
  title: string;
  message: string;
  severity?: SystemAlertSeverity;
  metadataJson?: Prisma.InputJsonValue;
}) {
  return createSystemAlert({
    type: input.type,
    severity: input.severity ?? "warning",
    title: input.title,
    message: input.message,
    metadataJson: input.metadataJson,
  });
}

export async function listSystemAlerts(
  session: AlertAdminSession,
  filters: { status?: SystemAlertStatus; severity?: SystemAlertSeverity; type?: string } = {},
) {
  assertPlatformRole(session.user.platformRole, ALERT_READ_ROLES);

  return prisma.systemAlert.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.type ? { type: { contains: filters.type, mode: "insensitive" } } : {}),
    },
    include: { resolvedBy: { select: { id: true, fullName: true, email: true } } },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function getSystemAlert(session: AlertAdminSession, alertId: string) {
  assertPlatformRole(session.user.platformRole, ALERT_READ_ROLES);

  const alert = await prisma.systemAlert.findUnique({
    where: { id: alertId },
    include: { resolvedBy: { select: { id: true, fullName: true, email: true } } },
  });

  if (!alert) throw new Error("System alert not found.");
  return alert;
}

export async function updateSystemAlertStatus(
  session: AlertAdminSession,
  alertId: string,
  status: Extract<SystemAlertStatus, "resolved" | "ignored">,
) {
  assertPlatformRole(session.user.platformRole, ALERT_MANAGE_ROLES);

  const alert = await prisma.systemAlert.update({
    where: { id: alertId },
    data: {
      status,
      resolvedById: session.user.id ?? null,
      resolvedAt: new Date(),
    },
  });

  await createAuditEvent({
    actorUserId: session.user.id ?? null,
    action: status === "resolved" ? "system_alert.resolved" : "system_alert.ignored",
    targetType: "system_alert",
    targetId: alert.id,
    details: { type: alert.type, severity: alert.severity },
  });

  return alert;
}

export async function getSystemAlertMetrics(session: AlertAdminSession) {
  assertPlatformRole(session.user.platformRole, ALERT_READ_ROLES);

  const [open, critical, warning, recent] = await Promise.all([
    prisma.systemAlert.count({ where: { status: "open" } }),
    prisma.systemAlert.count({ where: { status: "open", severity: "critical" } }),
    prisma.systemAlert.count({ where: { status: "open", severity: "warning" } }),
    prisma.systemAlert.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return { open, critical, warning, recent };
}

function sanitizeMessage(message: string) {
  return message
    .replace(/(sk_live|sk_test)_[A-Za-z0-9_]+/g, "$1_[redacted]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted_aws_access_key]")
    .replace(/(secret|password|token|api[_-]?key|credential)=([^&\s]+)/gi, "$1=[redacted]");
}

function sanitizeMetadata(value: Prisma.InputJsonValue | undefined) {
  if (value === undefined || value === null) return value;
  return sanitizeJson(value) as Prisma.InputJsonValue;
}

function sanitizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeJson);
  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        /(secret|password|token|api[_-]?key|credential|authorization|cookie|session|dsn)/i.test(key)
          ? "[redacted]"
          : sanitizeJson(entry),
      ]),
    );
  }
  if (typeof value === "string") return sanitizeMessage(value);
  return value;
}
