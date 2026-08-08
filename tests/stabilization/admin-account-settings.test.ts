import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin account settings", () => {
  it("exposes a professional account settings path with direct password management", () => {
    const page = readFileSync("src/app/(app)/admin/settings/page.tsx", "utf8");
    const actions = readFileSync("src/app/(app)/admin/settings/actions.ts", "utf8");

    expect(page).toContain("Personal admin account");
    expect(page).toContain("Change password");
    expect(page).toContain("updateAdminPasswordAction");
    expect(actions).toContain("verifyPassword");
    expect(actions).toContain("hashPassword");
    expect(actions).toContain("user.password_changed");
  });

  it("does not serialize the full authenticated user record into the client sidebar", () => {
    const appShell = readFileSync("src/components/layout/app-shell.tsx", "utf8");
    const sidebarNav = readFileSync("src/components/layout/sidebar-nav.tsx", "utf8");

    expect(appShell).toContain("const navSession =");
    expect(appShell).toContain("<SidebarNav session={navSession}");
    expect(appShell).not.toContain("<SidebarNav session={session}");
    expect(sidebarNav).toContain("type NavSessionLike");
    expect(sidebarNav).not.toContain("getCurrentSession");
  });
});
