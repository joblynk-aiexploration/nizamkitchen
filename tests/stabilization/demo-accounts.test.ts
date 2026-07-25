import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const currentDemoEmails = [
  "owner@nizamkitchen.dev",
  "household@nizamkitchen.dev",
  "chefstaff@nizamkitchen.dev",
  "cateringstaff@nizamkitchen.dev",
  "restaurant@nizamkitchen.dev",
];
const legacyDemoEmails = [
  "admin@nizamkitchen.dev",
  "country@nizamkitchen.dev",
  "chef@nizamkitchen.dev",
  "catering@nizamkitchen.dev",
  "support@nizamkitchen.dev",
  "auditor@nizamkitchen.dev",
];

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function userSeedsBlock() {
  const source = read("prisma/seed.ts");
  return source.slice(source.indexOf("const USER_SEEDS"), source.indexOf("const LEGACY_DEMO_EMAILS"));
}

describe("simplified demo account foundation", () => {
  it("seeds only the five current demo login users", () => {
    const block = userSeedsBlock();

    for (const email of currentDemoEmails) {
      expect(block).toContain(email);
    }
    for (const email of legacyDemoEmails) {
      expect(block).not.toContain(email);
    }
    expect((block.match(/email:/g) ?? []).length).toBe(5);
  });

  it("seeds the current demo organizations and profile ownership", () => {
    const source = read("prisma/seed.ts");

    expect(source).toContain("Nizam Family Kitchen");
    expect(source).toContain("Nizam Independent Home Chef");
    expect(source).toContain("Nizam Home Catering");
    expect(source).toContain("Biryani House Demo Restaurant");
    expect(source).toContain("OrganizationRole.org_owner");
    expect(source).toContain("OrganizationRole.chef_staff");
    expect(source).toContain("OrganizationRole.home_catering_staff");
    expect(source).toContain("OrganizationRole.restaurant_owner");
  });

  it("provides a local-only reset script for removing legacy demo accounts", () => {
    const script = read("scripts/dev/reset-demo-accounts.ts");
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(packageJson.scripts["dev:reset-demo-accounts"]).toBe("tsx scripts/dev/reset-demo-accounts.ts");
    expect(script).toContain("Local/dev only. Do not run against production.");
    for (const email of legacyDemoEmails) {
      expect(script).toContain(email);
    }
    for (const email of currentDemoEmails) {
      expect(script).toContain(email);
    }
  });
});
