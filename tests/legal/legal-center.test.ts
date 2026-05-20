import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent } = vi.hoisted(() => ({
  mockPrisma: {
    legalDocument: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    legalDocumentAcceptance: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    legalConsentEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
  createAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));

import {
  createAcceptance,
  createConsentEvent,
  getLatestPublishedLegalDocument,
  getRequiredLegalDocumentTypesForOrganization,
  hasAcceptedLatestRequiredDocuments,
  listLegalDocuments,
  updateDraftLegalDocument,
} from "@/server/legal/legal-service";

function document(overrides = {}) {
  return {
    id: "doc-1",
    documentType: "terms_of_service",
    title: "Terms of Service",
    slug: "terms-of-service",
    version: "1.0.0",
    status: "published",
    countryCode: null,
    region: null,
    audience: "all_users",
    contentMarkdown: "Template placeholder",
    effectiveAt: new Date(),
    createdById: "admin-1",
    publishedById: "admin-1",
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("legal documents and consent center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.legalDocument.findMany.mockResolvedValue([document()]);
    mockPrisma.legalDocumentAcceptance.findMany.mockResolvedValue([]);
    mockPrisma.legalDocumentAcceptance.findFirst.mockResolvedValue(null);
    mockPrisma.legalDocumentAcceptance.create.mockImplementation(({ data }) => Promise.resolve({ id: "acceptance-1", ...data }));
    mockPrisma.legalConsentEvent.create.mockImplementation(({ data }) => Promise.resolve({ id: "consent-1", createdAt: new Date(), ...data }));
  });

  it("prevents published documents from being overwritten silently", async () => {
    mockPrisma.legalDocument.findUniqueOrThrow.mockResolvedValue(document({ status: "published" }));

    await expect(updateDraftLegalDocument(
      { user: { id: "admin-1", platformRole: "platform_owner" } },
      "doc-1",
      { title: "Changed title" },
    )).rejects.toThrow("Published legal documents cannot be edited");
  });

  it("requires different legal documents for household and seller organizations", () => {
    expect(getRequiredLegalDocumentTypesForOrganization("household")).toEqual(["terms_of_service", "privacy_policy"]);
    expect(getRequiredLegalDocumentTypesForOrganization("home_catering")).toContain("seller_agreement");
    expect(getRequiredLegalDocumentTypesForOrganization("chef_business")).toContain("home_chef_agreement");
    expect(getRequiredLegalDocumentTypesForOrganization("restaurant")).toContain("restaurant_partner_agreement");
  });

  it("requires re-acceptance when the latest required version is missing", async () => {
    mockPrisma.legalDocument.findMany.mockImplementation(({ where }) => Promise.resolve([
      document({ id: `doc-${where.documentType}`, documentType: where.documentType, version: "2.0.0" }),
    ]));
    mockPrisma.legalDocumentAcceptance.findMany.mockResolvedValue([
      { documentId: "doc-terms_of_service", acceptedVersion: "2.0.0" },
    ]);

    const result = await hasAcceptedLatestRequiredDocuments({
      user: { id: "user-1", platformRole: null },
      activeOrganization: { id: "org-1", organizationType: "household", countryCode: "US" },
    });

    expect(result.accepted).toBe(false);
    expect(result.missing.map((item) => item.documentType)).toContain("privacy_policy");
  });

  it("stores legal acceptance version, timestamp metadata, and audit log", async () => {
    mockPrisma.legalDocument.findUniqueOrThrow.mockResolvedValue(document({ id: "terms", version: "2.0.0" }));

    await createAcceptance({
      userId: "user-1",
      organizationId: "org-1",
      documentId: "terms",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(mockPrisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        acceptedVersion: "2.0.0",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "legal_document.accepted" }));
  });

  it("records background-check consent as an immutable legal consent event", async () => {
    await createConsentEvent({
      userId: "seller-1",
      organizationId: "seller-org",
      consentType: "background_check_consent",
      status: "accepted",
      textSnapshot: "I consent to a background check.",
      version: "1.0.0",
    });

    expect(mockPrisma.legalConsentEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      consentType: "background_check_consent",
      textSnapshot: "I consent to a background check.",
      version: "1.0.0",
    }) });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "legal_consent.accepted" }));
  });

  it("uses country-specific published documents ahead of global fallbacks", async () => {
    mockPrisma.legalDocument.findMany.mockResolvedValue([
      document({ id: "us-terms", countryCode: "US", title: "US Terms" }),
      document({ id: "global-terms", countryCode: null, title: "Global Terms" }),
    ]);

    const latest = await getLatestPublishedLegalDocument({ slug: "terms-of-service", countryCode: "US" });

    expect(latest?.id).toBe("us-terms");
  });

  it("protects admin legal pages from normal users", async () => {
    await expect(listLegalDocuments({ user: { id: "user-1", platformRole: null } })).rejects.toThrow("Platform role is required");
  });

  it("adds public and admin legal routes", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "src/app/(public)/legal/terms/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(public)/legal/privacy/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/admin/legal/documents/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/legal/accept-required/page.tsx"))).toBe(true);
  });
});
