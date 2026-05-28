import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { publicVerificationBadges } from "@/server/seller-verifications";

describe("seller verification production hardening", () => {
  it("keeps core verification and KYC routes present for admin and seller QA", () => {
    const routes = [
      "src/app/(app)/admin/verifications/page.tsx",
      "src/app/(app)/admin/verifications/[id]/page.tsx",
      "src/app/(app)/admin/verifications/requirements/page.tsx",
      "src/app/(app)/admin/verifications/background-checks/page.tsx",
      "src/app/(app)/admin/verifications/kitchen-reviews/page.tsx",
      "src/app/(app)/admin/kyc/page.tsx",
      "src/app/(app)/admin/kyc/providers/page.tsx",
      "src/app/(app)/admin/kyc/background-checks/page.tsx",
      "src/app/(app)/catering/verification/page.tsx",
      "src/app/(app)/chef/verification/page.tsx",
      "src/app/(app)/restaurant/verification/page.tsx",
    ];

    for (const route of routes) {
      expect(fs.existsSync(path.join(process.cwd(), route)), route).toBe(true);
    }
  });

  it("public verification badges expose only safe status labels", () => {
    const badges = publicVerificationBadges({
      status: "verified",
      verificationLevel: "fully_verified",
      foodSafetyCertificates: [{ status: "approved" }],
      kitchenReviews: [{ status: "approved" }],
      backgroundChecks: [{ status: "clear" }],
    });

    const rendered = JSON.stringify(badges).toLowerCase();
    expect(badges.map((badge) => badge.label)).toEqual([
      "Fully verified",
      "Food safety certificate verified",
      "Kitchen reviewed",
      "Background check complete",
    ]);
    expect(rendered).not.toMatch(/ssn|socialsecurity|dob|home address|documentfileid|providercandidateid|providerreportid|cert-|\blic-/);
  });

  it("public profile pages do not render private verification details", () => {
    const publicProfileFiles = [
      "src/app/(app)/chefs/[slug]/page.tsx",
      "src/app/(app)/caterers/[slug]/page.tsx",
      "src/app/(app)/restaurants/[slug]/page.tsx",
    ];
    const source = publicProfileFiles.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");

    expect(source).not.toMatch(/certificateNumber|permitNumber|providerReportId|providerCandidateId|resultSummary|documentFileId/i);
    expect(source).not.toMatch(new RegExp(["AI", "video", "analysis"].join("\\s+"), "i"));
    expect(source).not.toMatch(new RegExp(["Analyze", "with", "AI"].join("\\s+"), "i"));
  });
});
