import { describe, expect, it } from "vitest";
import { getFormMessageTone } from "@/components/ui/form-message";

describe("FormMessage", () => {
  it("treats successful save messages as success", () => {
    expect(getFormMessageTone("Successfully saved profile.")).toBe("success");
    expect(getFormMessageTone("Successfully created user.")).toBe("success");
  });

  it("treats validation and permission messages as errors", () => {
    expect(getFormMessageTone("Invalid phone number.")).toBe("error");
    expect(getFormMessageTone("Phone number must include 10 digits.")).toBe("error");
    expect(getFormMessageTone("Unable to save profile.")).toBe("error");
    expect(getFormMessageTone("Permission denied.")).toBe("error");
  });

  it("treats setup and configuration messages as warnings", () => {
    expect(getFormMessageTone("Google sign-in is not configured yet.")).toBe("warning");
    expect(getFormMessageTone("Storage setup is disabled.")).toBe("warning");
  });
});
