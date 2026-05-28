import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getActionErrorMessage } from "@/lib/server-action-errors";

describe("server action error messages", () => {
  it("does not show Next.js redirect internals as user-facing messages", () => {
    const redirectError = new Error("NEXT_REDIRECT");
    (redirectError as Error & { digest: string }).digest = "NEXT_REDIRECT;replace;/settings/preferences?message=Saved;307;";

    expect(getActionErrorMessage(redirectError, "Saved.")).toBe("Saved.");
  });

  it("keeps real validation errors visible", () => {
    expect(getActionErrorMessage(new Error("Name is required."), "Unable to save.")).toBe("Name is required.");
  });

  it("shows a readable message for Zod validation errors", () => {
    const schema = z.object({
      password: z.string().regex(/[A-Z]/, "Password must include an uppercase letter."),
    });
    const result = schema.safeParse({ password: "password123" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getActionErrorMessage(result.error, "Unable to create user.")).toBe("Password must include an uppercase letter.");
    }
  });

  it("shows a readable message when a validation error was stringified", () => {
    const rawMessage = JSON.stringify([
      {
        origin: "string",
        code: "invalid_format",
        path: ["password"],
        message: "Password must include an uppercase letter.",
      },
    ]);

    expect(getActionErrorMessage(new Error(rawMessage), "Unable to create user.")).toBe("Password must include an uppercase letter.");
  });
});
