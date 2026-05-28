import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailDeliveryStatus, EmailProvider } from "@prisma/client";

const { mockPrisma, mockResolveEmailProvider } = vi.hoisted(() => ({
  mockPrisma: {
    emailTemplate: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    emailSuppression: { findFirst: vi.fn() },
    emailPreference: { upsert: vi.fn() },
    emailLog: { create: vi.fn(), findFirst: vi.fn() },
  },
  mockResolveEmailProvider: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "https://nk.friscodawah.org",
    SMTP_HOST: "",
    SMTP_PORT: 587,
    SMTP_USER: "",
    SMTP_PASS: "",
    EMAIL_FROM: "",
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/email/providers/smtp-provider", () => ({ resolveEmailProvider: mockResolveEmailProvider }));

import { ENTERPRISE_EMAIL_TEMPLATES } from "@/server/email/email-events";
import { renderSeedTemplate } from "@/server/email/email-renderer";
import { sendTemplateEmail } from "@/server/email/email-service";

describe("enterprise email system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.emailTemplate.findMany.mockResolvedValue([]);
    mockPrisma.emailSuppression.findFirst.mockResolvedValue(null);
    mockPrisma.emailPreference.upsert.mockResolvedValue({
      transactionalEnabled: true,
      marketingEnabled: false,
      mealPlanningEmails: true,
      groceryEmails: true,
      orderEmails: true,
      homeChefEmails: true,
      sellerEmails: true,
      paymentEmails: true,
      verificationEmails: true,
      supportEmails: true,
      reviewEmails: true,
      promotionEmails: false,
      adminAlertEmails: true,
    });
    mockPrisma.emailLog.findFirst.mockResolvedValue(null);
    mockPrisma.emailLog.create.mockImplementation(async ({ data }) => ({ id: "email-log-1", ...data }));
    mockResolveEmailProvider.mockResolvedValue({
      provider: "disabled",
      send: vi.fn().mockResolvedValue({ sent: false, provider: "disabled", errorMessage: "Email delivery is not configured yet." }),
    });
  });

  it("defines the requested Prisma email models and enums", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("model EmailTemplate");
    expect(schema).toContain("model EmailTemplateVariable");
    expect(schema).toContain("model EmailLog");
    expect(schema).toContain("model EmailPreference");
    expect(schema).toContain("model EmailSuppression");
    expect(schema).toContain("enum EmailTemplateCategory");
    expect(schema).toContain("enum EmailProvider");
  });

  it("seeds broad enterprise templates across core modules", () => {
    const keys = ENTERPRISE_EMAIL_TEMPLATES.map((template) => template.templateKey);

    expect(keys).toContain("auth.welcome");
    expect(keys).toContain("auth.password_reset");
    expect(keys).toContain("order.accepted");
    expect(keys).toContain("payment.success");
    expect(keys).toContain("verification.document_rejected");
    expect(keys).toContain("support.ticket_created");
    expect(keys).toContain("admin.failed_email_delivery");
  });

  it("renders HTML and plain-text templates without exposing secret-like values", () => {
    const rendered = renderSeedTemplate("auth.password_reset", {
      userName: "Adam",
      userEmail: "adam@example.test",
      resetUrl: "https://nk.friscodawah.org/reset-password?token=redacted",
      clientSecret: "do-not-render-this-secret",
    });

    expect(rendered.subject).toBe("Reset your NizamKitchen password");
    expect(rendered.html).toContain("NizamKitchen");
    expect(rendered.html).toContain("Reset password");
    expect(rendered.html).toContain("https://nk.friscodawah.org/reset-password?token=redacted");
    expect(rendered.html).toContain("Security note");
    expect(rendered.text).toContain("Reset your NizamKitchen password");
    expect(rendered.text).toContain("Reset password: https://nk.friscodawah.org/reset-password?token=redacted");
    expect(rendered.text).toContain("copy and paste this secure reset link");
    expect(rendered.html).not.toContain("do-not-render-this-secret");
    expect(rendered.text).not.toContain("do-not-render-this-secret");
  });

  it("handles missing variables safely", () => {
    const rendered = renderSeedTemplate("order.submitted", { userName: "Aisha" });

    expect(rendered.missingVariables).toEqual(expect.arrayContaining(["orderNumber", "sellerName"]));
    expect(rendered.html).not.toContain("{{orderNumber}}");
  });

  it("does not crash when SMTP is missing and logs a skipped delivery", async () => {
    await expect(sendTemplateEmail({
      to: "household@example.test",
      recipientUserId: "user-1",
      templateKey: "order.submitted",
      variables: { userName: "Aisha", orderNumber: "NK-1", sellerName: "Nizam Home Catering" },
    })).resolves.toEqual(expect.objectContaining({ sent: false }));

    expect(mockPrisma.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailDeliveryStatus.skipped,
          provider: EmailProvider.disabled,
          deliveryStatus: "skipped_no_smtp",
        }),
      }),
    );
  });

  it("suppresses marketing emails when marketing preferences are off", async () => {
    await sendTemplateEmail({
      to: "household@example.test",
      recipientUserId: "user-1",
      templateKey: "promotion.code_available",
      variables: { userName: "Aisha" },
    });

    expect(mockPrisma.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailDeliveryStatus.skipped,
          deliveryStatus: "skipped_by_preference",
        }),
      }),
    );
  });

  it("logs suppressed recipients without sending", async () => {
    mockPrisma.emailSuppression.findFirst.mockResolvedValue({ id: "suppression-1" });

    await sendTemplateEmail({
      to: "blocked@example.test",
      templateKey: "support.ticket_created",
      variables: { userName: "Aisha", ticketNumber: "TKT-1", ticketTitle: "Help" },
    });

    expect(mockPrisma.emailLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmailDeliveryStatus.suppressed,
          deliveryStatus: "suppressed",
        }),
      }),
    );
  });
});
