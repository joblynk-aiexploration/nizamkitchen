import { describe, expect, it } from "vitest";
import {
  AccessDeniedError,
  assertCountryAccess,
  assertPlatformRole,
  assertUserCanAuthenticate,
} from "../../src/lib/auth";
import { canAccessPlatformAdmin } from "../../src/lib/permissions";

describe("platform and country permissions", () => {
  it("prevents a regular member from accessing platform admin pages", () => {
    expect(
      canAccessPlatformAdmin({
        platformRole: null,
      }),
    ).toBe(false);

    expect(() =>
      assertPlatformRole(null, ["platform_owner", "platform_admin"]),
    ).toThrow(AccessDeniedError);
  });

  it("prevents an organization admin from accessing platform admin pages", () => {
    expect(
      canAccessPlatformAdmin({
        platformRole: null,
      }),
    ).toBe(false);
  });

  it("prevents a country manager from managing unassigned countries", () => {
    expect(() =>
      assertCountryAccess(
        {
          user: {
            id: "user-country-manager",
            email: "country@example.com",
            status: "active",
            platformRole: "country_manager",
          },
          countryAssignments: [{ countryCode: "US" }],
        },
        "IN",
      ),
    ).toThrow(AccessDeniedError);
  });

  it("prevents disabled users from logging in", () => {
    expect(() =>
      assertUserCanAuthenticate({
        status: "disabled",
      }),
    ).toThrow(AccessDeniedError);
  });
});
