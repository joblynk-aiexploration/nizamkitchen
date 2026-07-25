import { describe, expect, it } from "vitest";
import { normalizePhoneParts, sanitizeNationalPhoneNumber, splitPhoneNumber } from "@/lib/phone";

describe("phone formatting", () => {
  it("formats phone numbers as country code plus 10 digits", () => {
    expect(normalizePhoneParts({ phoneCountryCode: "+1", phoneNationalNumber: "(555) 123-4567" })).toBe("+1 5551234567");
    expect(normalizePhoneParts({ phoneCountryCode: "91", phoneNationalNumber: "9876543210" })).toBe("+91 9876543210");
  });

  it("keeps optional phone fields empty and rejects short national numbers", () => {
    expect(normalizePhoneParts({ phoneCountryCode: "+1", phoneNationalNumber: "" })).toBeNull();
    expect(() => normalizePhoneParts({ phoneCountryCode: "+1", phoneNationalNumber: "555" })).toThrow("10 digit");
  });

  it("splits stored phone values back into dropdown and number fields", () => {
    expect(splitPhoneNumber("+971 5012345670", "+1")).toEqual({
      phoneCountryCode: "+971",
      phoneNationalNumber: "5012345670",
    });
    expect(splitPhoneNumber("+1 5551234567", "+91")).toEqual({
      phoneCountryCode: "+1",
      phoneNationalNumber: "5551234567",
    });
  });

  it("sanitizes visible phone input to digits only", () => {
    expect(sanitizeNationalPhoneNumber("dsad")).toBe("");
    expect(sanitizeNationalPhoneNumber("555-abc-123-4567")).toBe("5551234567");
    expect(sanitizeNationalPhoneNumber("1234567890123")).toBe("1234567890");
  });
});
