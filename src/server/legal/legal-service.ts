import { redirect } from "next/navigation";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import type {
  LegalAudience,
  LegalDocument,
  LegalDocumentType,
  Organization,
  OrganizationType,
  PlatformRole,
  Prisma,
  User,
} from "@prisma/client";

type AdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
};

type UserContext = {
  user: Pick<User, "id" | "platformRole">;
  activeOrganization?: Pick<Organization, "id" | "organizationType" | "countryCode"> | null;
};

const LEGAL_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];
const LEGAL_READ_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin", "auditor"];

const publicSlugByType: Partial<Record<LegalDocumentType, string>> = {
  terms_of_service: "terms-of-service",
  privacy_policy: "privacy-policy",
  refund_policy: "refund-policy",
  cancellation_policy: "cancellation-policy",
  food_safety_policy: "food-safety-policy",
  seller_agreement: "seller-agreement",
};

function legalDocumentsDelegate() {
  return (prisma as unknown as { legalDocument?: typeof prisma.legalDocument }).legalDocument;
}

function legalAcceptancesDelegate() {
  return (prisma as unknown as { legalDocumentAcceptance?: typeof prisma.legalDocumentAcceptance }).legalDocumentAcceptance;
}

function legalConsentsDelegate() {
  return (prisma as unknown as { legalConsentEvent?: typeof prisma.legalConsentEvent }).legalConsentEvent;
}

export function getRequiredLegalDocumentTypesForOrganization(
  organizationType?: OrganizationType | null,
): LegalDocumentType[] {
  if (!organizationType) return ["terms_of_service", "privacy_policy"];
  if (organizationType === "household") return ["terms_of_service", "privacy_policy"];
  if (organizationType === "chef_business") {
    return ["terms_of_service", "privacy_policy", "home_chef_agreement", "food_safety_policy"];
  }
  if (organizationType === "home_catering") {
    return ["terms_of_service", "privacy_policy", "home_catering_agreement", "food_safety_policy", "seller_agreement"];
  }
  if (organizationType === "restaurant") {
    return ["terms_of_service", "privacy_policy", "restaurant_partner_agreement", "seller_agreement"];
  }
  return ["terms_of_service", "privacy_policy"];
}

export function audienceForOrganizationType(organizationType?: OrganizationType | null): LegalAudience {
  if (organizationType === "household") return "households";
  if (organizationType === "chef_business") return "chefs";
  if (organizationType === "home_catering") return "home_catering";
  if (organizationType === "restaurant") return "restaurants";
  return "all_users";
}

export async function getLatestPublishedLegalDocument(params: {
  documentType?: LegalDocumentType;
  slug?: string;
  countryCode?: string | null;
  region?: string | null;
  audience?: LegalAudience | null;
}) {
  const legalDocument = legalDocumentsDelegate();
  if (!legalDocument) return null;
  const where: Prisma.LegalDocumentWhereInput = {
    status: "published",
    ...(params.documentType ? { documentType: params.documentType } : {}),
    ...(params.slug ? { slug: params.slug } : {}),
    OR: [
      { countryCode: params.countryCode ?? undefined, region: params.region ?? undefined },
      { countryCode: params.countryCode ?? undefined, region: null },
      { countryCode: null, region: null },
    ],
    audience: params.audience ? { in: [params.audience, "all_users", "sellers"] } : undefined,
  };

  const documents = await legalDocument.findMany({
    where,
    orderBy: [{ countryCode: "desc" }, { effectiveAt: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return documents[0] ?? null;
}

export async function getRequiredLegalDocumentsForUser(context: UserContext) {
  const organization = context.activeOrganization;
  const requiredTypes = getRequiredLegalDocumentTypesForOrganization(organization?.organizationType);
  const audience = audienceForOrganizationType(organization?.organizationType);
  const documents = await Promise.all(
    requiredTypes.map((documentType) =>
      getLatestPublishedLegalDocument({
        documentType,
        countryCode: organization?.countryCode ?? null,
        audience,
      }),
    ),
  );
  return documents.filter(Boolean) as LegalDocument[];
}

export async function hasAcceptedLatestRequiredDocuments(context: UserContext) {
  const legalDocumentAcceptance = legalAcceptancesDelegate();
  if (!legalDocumentAcceptance) return { accepted: true, missing: [] as LegalDocument[] };
  const required = await getRequiredLegalDocumentsForUser(context);
  if (required.length === 0) return { accepted: true, missing: [] as LegalDocument[] };

  const acceptances = await legalDocumentAcceptance.findMany({
    where: {
      userId: context.user.id,
      organizationId: context.activeOrganization?.id ?? null,
      documentId: { in: required.map((document) => document.id) },
    },
  });
  const acceptedByDocumentId = new Map(acceptances.map((acceptance) => [acceptance.documentId, acceptance.acceptedVersion]));
  const missing = required.filter((document) => acceptedByDocumentId.get(document.id) !== document.version);
  return { accepted: missing.length === 0, missing };
}

export async function requireLegalAcceptance(context: UserContext) {
  const result = await hasAcceptedLatestRequiredDocuments(context);
  if (!result.accepted && context.user.platformRole !== "platform_owner") {
    redirect("/legal/accept-required");
  }
  return result;
}

export async function createAcceptance(params: {
  userId: string;
  organizationId?: string | null;
  documentId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const legalDocument = legalDocumentsDelegate();
  const legalDocumentAcceptance = legalAcceptancesDelegate();
  if (!legalDocument || !legalDocumentAcceptance) {
    throw new Error("Legal document storage is not available.");
  }
  const document = await legalDocument.findUniqueOrThrow({ where: { id: params.documentId } });
  const existing = await legalDocumentAcceptance.findFirst({
    where: {
      documentId: params.documentId,
      userId: params.userId,
      organizationId: params.organizationId ?? null,
    },
  });
  const acceptance = existing ? await legalDocumentAcceptance.update({
    where: { id: existing.id },
    data: {
      acceptedVersion: document.version,
      acceptedAt: new Date(),
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  }) : await legalDocumentAcceptance.create({
    data: {
      documentId: params.documentId,
      userId: params.userId,
      organizationId: params.organizationId ?? null,
      acceptedVersion: document.version,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
  await createAuditEvent({
    actorUserId: params.userId,
    organizationId: params.organizationId ?? null,
    action: "legal_document.accepted",
    targetType: "legal_document",
    targetId: document.id,
    details: { version: document.version, documentType: document.documentType },
  });
  return acceptance;
}

export async function createConsentEvent(params: {
  userId: string;
  organizationId?: string | null;
  consentType: LegalDocumentType;
  status: "accepted" | "revoked" | "declined";
  textSnapshot: string;
  version: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const legalConsentEvent = legalConsentsDelegate();
  const consent = legalConsentEvent
    ? await legalConsentEvent.create({ data: params })
    : { id: "legal-consent-unavailable", ...params };
  await createAuditEvent({
    actorUserId: params.userId,
    organizationId: params.organizationId ?? null,
    action: params.status === "accepted" ? "legal_consent.accepted" : "legal_consent.declined",
    targetType: "legal_consent",
    targetId: consent.id,
    details: { consentType: params.consentType, version: params.version, status: params.status },
  });
  return consent;
}

export async function listLegalDocuments(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, LEGAL_READ_ROLES);
  const legalDocument = legalDocumentsDelegate();
  if (!legalDocument) return [];
  return legalDocument.findMany({
    include: {
      createdBy: { select: { fullName: true, email: true } },
      publishedBy: { select: { fullName: true, email: true } },
      _count: { select: { acceptances: true } },
    },
    orderBy: [{ documentType: "asc" }, { createdAt: "desc" }],
  });
}

export async function getLegalDocumentForAdmin(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, LEGAL_READ_ROLES);
  const legalDocument = legalDocumentsDelegate();
  if (!legalDocument) return null;
  return legalDocument.findUnique({
    where: { id },
    include: {
      createdBy: { select: { fullName: true, email: true } },
      publishedBy: { select: { fullName: true, email: true } },
      acceptances: { include: { user: true, organization: true }, orderBy: { acceptedAt: "desc" }, take: 100 },
    },
  });
}

export async function createLegalDocument(session: AdminSession, input: {
  documentType: LegalDocumentType;
  title: string;
  slug: string;
  version: string;
  audience: LegalAudience;
  contentMarkdown: string;
  countryCode?: string | null;
  region?: string | null;
}) {
  assertPlatformRole(session.user.platformRole, LEGAL_ADMIN_ROLES);
  const legalDocument = legalDocumentsDelegate();
  if (!legalDocument) throw new Error("Legal document storage is not available.");
  const document = await legalDocument.create({
    data: { ...input, countryCode: input.countryCode ?? null, region: input.region ?? null, createdById: session.user.id },
  });
  await createAuditEvent({ actorUserId: session.user.id, action: "legal_document.created", targetType: "legal_document", targetId: document.id });
  return document;
}

export async function updateDraftLegalDocument(session: AdminSession, id: string, input: Partial<Pick<LegalDocument, "title" | "contentMarkdown" | "effectiveAt">>) {
  assertPlatformRole(session.user.platformRole, LEGAL_ADMIN_ROLES);
  const legalDocument = legalDocumentsDelegate();
  if (!legalDocument) throw new Error("Legal document storage is not available.");
  const existing = await legalDocument.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "draft") {
    throw new Error("Published legal documents cannot be edited. Create a new version instead.");
  }
  const document = await legalDocument.update({ where: { id }, data: input });
  await createAuditEvent({ actorUserId: session.user.id, action: "legal_document.updated", targetType: "legal_document", targetId: id });
  return document;
}

export async function publishLegalDocument(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, LEGAL_ADMIN_ROLES);
  const legalDocument = legalDocumentsDelegate();
  if (!legalDocument) throw new Error("Legal document storage is not available.");
  const document = await legalDocument.update({
    where: { id },
    data: { status: "published", publishedById: session.user.id, publishedAt: new Date() },
  });
  await createAuditEvent({ actorUserId: session.user.id, action: "legal_document.published", targetType: "legal_document", targetId: id });
  return document;
}

export async function archiveLegalDocument(session: AdminSession, id: string) {
  assertPlatformRole(session.user.platformRole, LEGAL_ADMIN_ROLES);
  const legalDocument = legalDocumentsDelegate();
  if (!legalDocument) throw new Error("Legal document storage is not available.");
  const document = await legalDocument.update({ where: { id }, data: { status: "archived" } });
  await createAuditEvent({ actorUserId: session.user.id, action: "legal_document.archived", targetType: "legal_document", targetId: id });
  return document;
}

export async function listLegalAcceptances(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, LEGAL_READ_ROLES);
  const legalDocumentAcceptance = legalAcceptancesDelegate();
  if (!legalDocumentAcceptance) return [];
  return legalDocumentAcceptance.findMany({
    include: { document: true, user: true, organization: true },
    orderBy: { acceptedAt: "desc" },
    take: 250,
  });
}

export async function listLegalConsentEvents(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, LEGAL_READ_ROLES);
  const legalConsentEvent = legalConsentsDelegate();
  if (!legalConsentEvent) return [];
  return legalConsentEvent.findMany({
    include: { user: true, organization: true },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
}

export function publicLegalSlugForType(documentType: LegalDocumentType) {
  return publicSlugByType[documentType] ?? documentType.replace(/_/g, "-");
}
