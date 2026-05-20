import crypto from "node:crypto";
import {
  DataCategory,
  type DataPrivacyRequestStatus,
  type DataPrivacyRequestType,
  type PlatformRole,
  Prisma,
  type UserStatus,
} from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  adminDataPrivacyRequestUpdateSchema,
  dataPrivacyRequestCreateSchema,
  dataRetentionPolicySchema,
} from "@/lib/validation/privacy";
import { createAuditEvent } from "@/server/audit";
import { getStorageProvider } from "@/server/storage/storage-service";
import { buildStorageObjectKey } from "@/server/storage/storage-keys";

const PRIVACY_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin", "auditor"];
const PRIVACY_MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export type PrivacySession = {
  user: { id: string; email?: string; status?: UserStatus; platformRole: PlatformRole | null };
  activeOrganization?: { id: string; countryCode: string; organizationType?: string | null } | null;
};

export async function createDataPrivacyRequest(session: PrivacySession, input: unknown) {
  const parsed = dataPrivacyRequestCreateSchema.parse(input);
  const userScopedTypes: DataPrivacyRequestType[] = ["user_export", "account_deletion", "anonymization", "correction_request"];
  const organizationScopedTypes: DataPrivacyRequestType[] = ["organization_export", "organization_deletion"];
  const request = await prisma.dataPrivacyRequest.create({
    data: {
      userId: userScopedTypes.includes(parsed.requestType) ? session.user.id : null,
      organizationId: organizationScopedTypes.includes(parsed.requestType) ? session.activeOrganization?.id ?? null : session.activeOrganization?.id ?? null,
      requestedById: session.user.id,
      requestType: parsed.requestType,
      countryCode: session.activeOrganization?.countryCode ?? null,
      reason: parsed.reason ?? null,
    },
    include: requestInclude,
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: "privacy_request.created",
    targetType: "data_privacy_request",
    targetId: request.id,
    details: { requestType: request.requestType },
  });
  return request;
}

export async function listUserPrivacyRequests(session: PrivacySession) {
  return prisma.dataPrivacyRequest.findMany({
    where: {
      OR: [
        { requestedById: session.user.id },
        { userId: session.user.id },
        ...(session.activeOrganization?.id ? [{ organizationId: session.activeOrganization.id }] : []),
      ],
    },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserPrivacyRequest(session: PrivacySession, requestId: string) {
  const request = await prisma.dataPrivacyRequest.findFirst({
    where: {
      id: requestId,
      OR: [
        { requestedById: session.user.id },
        { userId: session.user.id },
        ...(session.activeOrganization?.id ? [{ organizationId: session.activeOrganization.id }] : []),
      ],
    },
    include: requestInclude,
  });
  if (!request) throw new Error("Privacy request not found.");
  return request;
}

export async function listAdminPrivacyRequests(session: PrivacySession, filters?: {
  status?: DataPrivacyRequestStatus;
  requestType?: DataPrivacyRequestType;
}) {
  assertPlatformRole(session.user.platformRole, PRIVACY_ADMIN_ROLES);
  return prisma.dataPrivacyRequest.findMany({
    where: {
      status: filters?.status,
      requestType: filters?.requestType,
    },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminPrivacyRequest(session: PrivacySession, requestId: string) {
  assertPlatformRole(session.user.platformRole, PRIVACY_ADMIN_ROLES);
  const request = await prisma.dataPrivacyRequest.findUnique({ where: { id: requestId }, include: requestInclude });
  if (!request) throw new Error("Privacy request not found.");
  return request;
}

export async function updateAdminPrivacyRequest(session: PrivacySession, requestId: string, input: unknown) {
  assertPlatformRole(session.user.platformRole, PRIVACY_MANAGE_ROLES);
  const parsed = adminDataPrivacyRequestUpdateSchema.parse(input);
  const request = await prisma.dataPrivacyRequest.update({
    where: { id: requestId },
    data: {
      status: parsed.status,
      adminNotes: parsed.adminNotes ?? null,
      completedById: parsed.status === "completed" ? session.user.id : undefined,
      completedAt: parsed.status === "completed" ? new Date() : undefined,
    },
    include: requestInclude,
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: parsed.status === "rejected" ? "privacy_request.rejected" : parsed.status === "completed" ? "privacy_request.completed" : "privacy_request.approved",
    targetType: "data_privacy_request",
    targetId: request.id,
    details: { status: request.status },
  });
  return request;
}

export async function generatePrivacyExport(session: PrivacySession, requestId: string) {
  assertPlatformRole(session.user.platformRole, PRIVACY_MANAGE_ROLES);
  const request = await getAdminPrivacyRequest(session, requestId);
  if (request.requestType !== "user_export" && request.requestType !== "organization_export") {
    throw new Error("Only export requests can generate export files.");
  }
  const payload = await buildPrivacyExportPayload(request.userId ?? request.requestedById, request.organizationId);
  const body = Buffer.from(JSON.stringify(payload, privacyJsonReplacer, 2), "utf8");
  const file = await storePrivacyExportFile({
    actorUserId: session.user.id,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    requestId: request.id,
    body,
  });
  const updated = await prisma.dataPrivacyRequest.update({
    where: { id: request.id },
    data: { exportFileId: file.id, status: "completed", completedById: session.user.id, completedAt: new Date() },
    include: requestInclude,
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: "data_export.generated",
    targetType: "data_privacy_request",
    targetId: request.id,
    details: { exportFileId: file.id, preserved: ["payments", "audit_logs", "kyc_documents"] },
  });
  return updated;
}

export async function anonymizeUserForRequest(session: PrivacySession, requestId: string) {
  assertPlatformRole(session.user.platformRole, PRIVACY_MANAGE_ROLES);
  const request = await getAdminPrivacyRequest(session, requestId);
  const targetUserId = request.userId ?? request.requestedById;
  const anonymizedEmail = `deleted-${hashIdentifier(targetUserId)}@nizamkitchen.invalid`;
  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      fullName: "Deleted User",
      email: anonymizedEmail,
      status: "disabled",
      phone: null,
      headline: null,
      bio: null,
      location: null,
      locationText: null,
      profilePhotoFileId: null,
      coverPhotoFileId: null,
      publicProfileEnabled: false,
    },
  });
  await Promise.all([
    prisma.session.deleteMany({ where: { userId: targetUserId } }),
    prisma.storageFile.updateMany({
      where: {
        OR: [{ userId: targetUserId }, { uploadedById: targetUserId }],
        purpose: { in: ["user_profile_photo", "user_cover_photo"] },
        status: "active",
      },
      data: { status: "archived" },
    }),
    prisma.dataPrivacyRequest.update({
      where: { id: request.id },
      data: { status: "completed", completedById: session.user.id, completedAt: new Date() },
    }),
  ]);
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    action: "user.anonymized",
    targetType: "user",
    targetId: targetUserId,
    details: {
      preserved: ["payment ledger", "audit logs", "KYC/background-check summaries", "orders"],
      anonymizedEmail,
    },
  });
  return user;
}

export async function anonymizeOrganizationForRequest(session: PrivacySession, requestId: string) {
  assertPlatformRole(session.user.platformRole, PRIVACY_MANAGE_ROLES);
  const request = await getAdminPrivacyRequest(session, requestId);
  if (!request.organizationId) throw new Error("Organization request is missing an organization.");
  const organization = await prisma.organization.update({
    where: { id: request.organizationId },
    data: {
      name: `Deleted Organization ${hashIdentifier(request.organizationId).slice(0, 8)}`,
      status: "disabled",
      logoFileId: null,
      coverPhotoFileId: null,
    },
  });
  await prisma.dataPrivacyRequest.update({
    where: { id: request.id },
    data: { status: "completed", completedById: session.user.id, completedAt: new Date() },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: organization.id,
    countryCode: organization.countryCode,
    action: "organization.anonymized",
    targetType: "organization",
    targetId: organization.id,
    details: { preserved: ["payment ledger", "audit logs", "KYC/background-check summaries", "orders"] },
  });
  return organization;
}

export async function listRetentionPolicies(session: PrivacySession) {
  assertPlatformRole(session.user.platformRole, PRIVACY_ADMIN_ROLES);
  return prisma.dataRetentionPolicy.findMany({
    include: {
      createdBy: { select: { fullName: true, email: true } },
      updatedBy: { select: { fullName: true, email: true } },
    },
    orderBy: [{ dataCategory: "asc" }, { countryCode: "asc" }],
  });
}

export async function upsertRetentionPolicy(session: PrivacySession, input: unknown) {
  assertPlatformRole(session.user.platformRole, PRIVACY_MANAGE_ROLES);
  const parsed = dataRetentionPolicySchema.parse(input);
  const data = {
    countryCode: parsed.countryCode,
    dataCategory: parsed.dataCategory,
    retentionDays: parsed.retentionDays,
    action: parsed.action,
    status: parsed.status,
    notes: parsed.notes ?? null,
    updatedById: session.user.id,
  };
  const policy = parsed.id
    ? await prisma.dataRetentionPolicy.update({ where: { id: parsed.id }, data })
    : await prisma.dataRetentionPolicy.create({ data: { ...data, createdById: session.user.id } });
  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: policy.countryCode,
    action: parsed.id ? "retention_policy.updated" : "retention_policy.created",
    targetType: "data_retention_policy",
    targetId: policy.id,
    details: { dataCategory: policy.dataCategory, action: policy.action, retentionDays: policy.retentionDays },
  });
  return policy;
}

export function retentionWarningForCategory(category: DataCategory) {
  if (category === "payments") return "Payment ledger records may need to be retained for legal/accounting reasons.";
  if (category === "audit_logs") return "Audit logs may need to be retained for security and compliance reasons.";
  if (category === "kyc_documents") return "KYC/background-check records may be subject to provider/legal retention requirements.";
  return null;
}

async function buildPrivacyExportPayload(userId: string, organizationId?: string | null) {
  const organizationWhere = organizationId ? { id: organizationId } : { memberships: { some: { userId } } };
  const [user, memberships, organizations, householdProfile, mealPlans, groceryLists, foodOrders, supportTickets, notifications, storageFiles, legalAcceptances, paymentOrders, verificationProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        headline: true,
        bio: true,
        locationText: true,
        phone: true,
        preferredLanguage: true,
        publicProfileEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.membership.findMany({
      where: { userId, ...(organizationId ? { organizationId } : {}) },
      select: { id: true, organizationId: true, role: true, status: true, createdAt: true, updatedAt: true },
    }),
    prisma.organization.findMany({
      where: organizationWhere,
      select: { id: true, name: true, organizationType: true, status: true, countryCode: true, currencyCode: true, createdAt: true, updatedAt: true },
    }),
    organizationId ? prisma.householdProfile.findUnique({ where: { organizationId } }) : null,
    prisma.mealPlan.findMany({
      where: organizationId ? { organizationId } : { createdById: userId },
      take: 250,
      orderBy: { createdAt: "desc" },
    }),
    prisma.groceryList.findMany({
      where: organizationId ? { organizationId } : { createdById: userId },
      take: 250,
      orderBy: { createdAt: "desc" },
    }),
    prisma.foodOrder.findMany({
      where: organizationId
        ? { OR: [{ customerOrganizationId: organizationId }, { sellerOrganizationId: organizationId }, { organizationId }] }
        : { customerUserId: userId },
      select: {
        id: true,
        status: true,
        fulfillmentType: true,
        sellerType: true,
        requestedDate: true,
        requestedTimeWindow: true,
        subtotalAmount: true,
        currencyCode: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        customerNotes: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 250,
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportTicket.findMany({
      where: organizationId ? { organizationId } : { createdById: userId },
      select: { id: true, type: true, status: true, priority: true, title: true, description: true, pageUrl: true, createdAt: true, updatedAt: true, closedAt: true },
      take: 250,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.findMany({
      where: organizationId ? { organizationId } : { userId },
      select: { id: true, type: true, title: true, body: true, actionUrl: true, status: true, priority: true, readAt: true, createdAt: true },
      take: 250,
      orderBy: { createdAt: "desc" },
    }),
    prisma.storageFile.findMany({
      where: organizationId ? { organizationId } : { OR: [{ userId }, { uploadedById: userId }] },
      select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, visibility: true, status: true, purpose: true, module: true, entityType: true, entityId: true, createdAt: true, updatedAt: true },
      take: 250,
      orderBy: { createdAt: "desc" },
    }),
    prisma.legalDocumentAcceptance.findMany({
      where: organizationId ? { organizationId } : { userId },
      include: { document: { select: { title: true, documentType: true, slug: true } } },
      orderBy: { acceptedAt: "desc" },
    }),
    prisma.paymentOrder.findMany({
      where: organizationId
        ? { OR: [{ organizationId }, { customerOrganizationId: organizationId }, { sellerOrganizationId: organizationId }] }
        : { customerUserId: userId },
      select: { id: true, module: true, moduleEntityId: true, provider: true, status: true, amount: true, currencyCode: true, platformFeeAmount: true, sellerAmount: true, taxAmount: true, paidAt: true, cancelledAt: true, createdAt: true, updatedAt: true },
      take: 250,
      orderBy: { createdAt: "desc" },
    }),
    organizationId ? prisma.sellerVerificationProfile.findUnique({
      where: { organizationId },
      select: { id: true, sellerType: true, status: true, verificationLevel: true, submittedAt: true, reviewedAt: true, rejectionReason: true, createdAt: true, updatedAt: true },
    }) : null,
  ]);

  return {
    exportedAt: new Date().toISOString(),
    scope: organizationId ? "organization" : "user",
    user,
    memberships,
    organizations,
    householdProfile,
    mealPlans,
    groceryLists,
    orders: foodOrders,
    supportTickets,
    notifications,
    uploadedFilesMetadata: storageFiles,
    legalAcceptances,
    paymentSummaries: paymentOrders,
    kycSummary: verificationProfile,
    excludedSensitiveData: [
      "password hashes",
      "session tokens",
      "raw payment provider payloads",
      "payment gateway secrets",
      "raw KYC documents",
      "full background-check reports",
      "S3 object contents",
    ],
  };
}

async function storePrivacyExportFile(params: {
  actorUserId: string;
  organizationId?: string | null;
  countryCode?: string | null;
  requestId: string;
  body: Buffer;
}) {
  const { configuration, provider } = await getStorageProvider();
  const fileId = crypto.randomUUID();
  const filename = `privacy-export-${params.requestId}.json`;
  const objectKey = buildStorageObjectKey({
    countryCode: params.countryCode ?? "system",
    organizationId: params.organizationId ?? "system",
    module: "privacy",
    entityType: "data_privacy_request",
    entityId: params.requestId,
    purpose: "data_export",
    fileId,
    originalFilename: filename,
  });
  await provider.uploadFile({ objectKey, body: params.body, mimeType: "application/json" });
  const checksumSha256 = crypto.createHash("sha256").update(params.body).digest("hex");
  return prisma.storageFile.create({
    data: {
      id: fileId,
      organizationId: params.organizationId ?? null,
      userId: null,
      uploadedById: params.actorUserId,
      countryCode: params.countryCode ?? null,
      module: "privacy",
      entityType: "data_privacy_request",
      entityId: params.requestId,
      provider: configuration.provider,
      bucketName: configuration.bucketName,
      objectKey,
      originalFilename: filename,
      storedFilename: objectKey.split("/").at(-1) ?? filename,
      mimeType: "application/json",
      fileExtension: "json",
      sizeBytes: params.body.byteLength,
      checksumSha256,
      visibility: "private",
      purpose: "data_export",
      metadataJson: { requestId: params.requestId, generatedBy: params.actorUserId },
    },
  });
}

function hashIdentifier(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function privacyJsonReplacer(_key: string, value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toString();
  return value;
}

const requestInclude = {
  user: { select: { id: true, fullName: true, email: true, status: true } },
  organization: { select: { id: true, name: true, organizationType: true, countryCode: true } },
  requestedBy: { select: { id: true, fullName: true, email: true } },
  completedBy: { select: { id: true, fullName: true, email: true } },
  exportFile: { select: { id: true, originalFilename: true, visibility: true, status: true, purpose: true, createdAt: true } },
} satisfies Prisma.DataPrivacyRequestInclude;
