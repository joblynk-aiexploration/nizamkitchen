import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("payment settings page", () => {
  it("converts Stripe Connect setup failures into a user-facing redirect message", () => {
    const source = readFileSync("src/app/(app)/settings/payments/actions.ts", "utf8");

    expect(source).toContain("createPayoutOnboardingOrRedirect");
    expect(source).toContain("Stripe Connect is not fully enabled");
    expect(source).toContain("signed up for Connect");
    expect(source).toContain("encodeURIComponent(getPayoutSetupFailureMessage(error))");
  });
});
