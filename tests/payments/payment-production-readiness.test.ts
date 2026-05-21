import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("payment production readiness guards", () => {
  it("does not expose raw card collection fields in source", () => {
    const source = readAll(path.join(repoRoot, "src"));
    expect(source).not.toMatch(/name=["'](?:cardNumber|card_number|card-number|cvv|cvc)["']/i);
    expect(source).not.toMatch(/placeholder=["'][^"']*(?:card number|cvv|cvc)[^"']*["']/i);
  });

  it("does not reintroduce legacy video-analysis references in payment code", () => {
    const source = readAll(path.join(repoRoot, "src/server/payments")) + readAll(path.join(repoRoot, "src/app/(app)/admin/payments"));
    const removedFeaturePattern = new RegExp(["AI video", "analysis"].join(" "), "i");
    expect(source).not.toMatch(removedFeaturePattern);
    expect(source).not.toMatch(/Analyze with AI/i);
  });

  it("keeps webhook and CSV admin surfaces free of raw provider JSON", () => {
    const webhookPage = fs.readFileSync(path.join(repoRoot, "src/app/(app)/admin/payments/webhooks/page.tsx"), "utf8");
    const exportRoute = fs.readFileSync(path.join(repoRoot, "src/app/api/admin/payments/export/route.ts"), "utf8");
    expect(webhookPage).not.toContain("rawJson");
    expect(exportRoute).not.toContain("rawJson");
  });

  it("documents hosted-checkout and no-raw-card production policy", () => {
    for (const file of ["payments.md", "payment-gateway-setup.md", "stripe-setup.md", "paypal-setup.md", "payment-security.md"]) {
      expect(fs.existsSync(path.join(repoRoot, "docs", file))).toBe(true);
    }
    const securityDoc = fs.readFileSync(path.join(repoRoot, "docs/payment-security.md"), "utf8");
    expect(securityDoc).toMatch(/No raw card number fields/i);
    expect(securityDoc).toMatch(/Hosted checkout/i);
    expect(securityDoc).toMatch(/Webhook events are persisted by provider event ID/i);
  });
});

function readAll(dir: string): string {
  return fs.readdirSync(dir, { withFileTypes: true }).map((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return readAll(fullPath);
    if (!/\.(ts|tsx|md)$/.test(entry.name)) return "";
    return fs.readFileSync(fullPath, "utf8");
  }).join("\n");
}
