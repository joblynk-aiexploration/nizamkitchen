import { describe, expect, it } from "vitest";
import { getRegistrationValidationMessage, registerSchema } from "@/lib/validation/auth";

function registrationInput(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Test User",
    email: "test@example.com",
    password: "Vitest#2026!",
    organizationName: "Test Household",
    countryCode: "US",
    accountType: "household",
    acceptLegalTerms: "on",
    householdSize: 4,
    spiceLevel: "medium",
    ...overrides,
  };
}

describe("registration validation messages", () => {
  it("explains weak passwords instead of showing a generic registration error", () => {
    const parsed = registerSchema.safeParse(registrationInput({ password: "password" }));

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(getRegistrationValidationMessage(parsed.error)).toContain("uppercase");
    }
  });

  it("explains invalid email and missing country selections", () => {
    const badEmail = registerSchema.safeParse(registrationInput({ email: "not-email" }));
    const missingCountry = registerSchema.safeParse(registrationInput({ countryCode: "" }));

    expect(badEmail.success).toBe(false);
    if (!badEmail.success) expect(getRegistrationValidationMessage(badEmail.error)).toBe("Enter a valid email address.");

    expect(missingCountry.success).toBe(false);
    if (!missingCountry.success) expect(getRegistrationValidationMessage(missingCountry.error)).toBe("Choose your country.");
  });
});
