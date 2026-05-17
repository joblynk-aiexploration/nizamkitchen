import { describe, expect, it } from "vitest";
import { AccessDeniedError, assertMembershipAccess } from "../../src/lib/auth";

describe("tenant isolation", () => {
  it("prevents a user from organization A accessing organization B data", () => {
    expect(() =>
      assertMembershipAccess(
        {
          user: {
            id: "user-a",
            email: "user-a@example.com",
            status: "active",
            platformRole: null,
          },
          activeMembership: {
            organizationId: "org-a",
            role: "member",
            status: "active",
          },
          activeOrganization: {
            id: "org-a",
            countryCode: "US",
            status: "active",
          },
        },
        "org-b",
      ),
    ).toThrow(AccessDeniedError);
  });

  it("prevents suspended organizations from accessing protected app features", () => {
    expect(() =>
      assertMembershipAccess({
        user: {
          id: "user-suspended",
          email: "suspended@example.com",
          status: "active",
          platformRole: null,
        },
        activeMembership: {
          organizationId: "org-suspended",
          role: "org_admin",
          status: "active",
        },
        activeOrganization: {
          id: "org-suspended",
          countryCode: "US",
          status: "suspended",
        },
      }),
    ).toThrow(AccessDeniedError);
  });

  it("allows access when the active organization matches and is active", () => {
    expect(
      assertMembershipAccess(
        {
          user: {
            id: "user-active",
            email: "active@example.com",
            status: "active",
            platformRole: null,
          },
          activeMembership: {
            organizationId: "org-a",
            role: "org_admin",
            status: "active",
          },
          activeOrganization: {
            id: "org-a",
            countryCode: "US",
            status: "active",
          },
        },
        "org-a",
      ),
    ).toMatchObject({
      organizationId: "org-a",
      role: "org_admin",
    });
  });
});
