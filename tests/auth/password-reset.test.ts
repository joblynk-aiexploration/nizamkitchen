import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPasswordResetValidationMessage, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";

describe("password reset", () => {
  it("validates the forgot-password email with a friendly message", () => {
    const parsed = forgotPasswordSchema.safeParse({ email: "not-an-email" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(getPasswordResetValidationMessage(parsed.error)).toBe("Enter a valid email address.");
    }
  });

  it("requires a strong reset password and matching confirmation", () => {
    const weakPassword = resetPasswordSchema.safeParse({
      token: "abcdefghijklmnopqrstuvwxyz123456",
      password: "password",
      confirmPassword: "password",
    });
    const mismatch = resetPasswordSchema.safeParse({
      token: "abcdefghijklmnopqrstuvwxyz123456",
      password: "Vitest#2026!",
      confirmPassword: "Vitest#2027!",
    });

    expect(weakPassword.success).toBe(false);
    if (!weakPassword.success) {
      expect(getPasswordResetValidationMessage(weakPassword.error)).toContain("uppercase");
    }

    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(getPasswordResetValidationMessage(mismatch.error)).toBe("Passwords do not match.");
    }
  });

  it("stores reset tokens in a dedicated Prisma model rather than on the user record", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(schema).toContain("model PasswordResetToken");
    expect(schema).toMatch(/tokenHash\s+String\s+@unique/);
    expect(schema).toMatch(/expiresAt\s+DateTime/);
    expect(schema).toMatch(/usedAt\s+DateTime\?/);
  });

  it("uses specific forgot-password messages for sent and missing emails", () => {
    const service = fs.readFileSync(path.join(process.cwd(), "src/server/auth/password-reset-service.ts"), "utf8");

    expect(service).toContain("Password reset email sent. Please check your inbox");
    expect(service).toContain("No account exists for that email address");
    expect(service).not.toContain("If an account exists for that email");
  });
});
