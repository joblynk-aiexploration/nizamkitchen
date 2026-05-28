import fs from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../src/app/manifest";

const repoRoot = process.cwd();

function read(path: string) {
  return fs.readFileSync(`${repoRoot}/${path}`, "utf8");
}

describe("PWA foundation", () => {
  it("provides an installable manifest with app icons", () => {
    const data = manifest();

    expect(data.name).toBe("NizamKitchen");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/dashboard");
    expect(data.icons?.some((icon) => icon.src === "/icons/nizam-icon.svg")).toBe(true);
    expect(data.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("includes service worker and offline fallback assets", () => {
    expect(fs.existsSync(`${repoRoot}/public/sw.js`)).toBe(true);
    expect(fs.existsSync(`${repoRoot}/public/icons/nizam-icon.svg`)).toBe(true);
    expect(fs.existsSync(`${repoRoot}/public/icons/nizam-maskable.svg`)).toBe(true);
    expect(read("src/app/offline/page.tsx")).toContain("NizamKitchen is waiting for a connection");
  });

  it("does not leave a sticky service worker registered during local development", () => {
    const register = read("src/components/pwa/pwa-register.tsx");

    expect(register).toContain('process.env.NODE_ENV === "production"');
    expect(register).toContain("registration.unregister()");
    expect(register).toContain("window.location.hostname");
  });
});

describe("mobile cooking and shopping modes", () => {
  it("recipe detail links to cooking mode", () => {
    expect(read("src/app/(app)/recipes/[id]/page.tsx")).toContain("Cooking Mode");
  });

  it("cooking mode renders large step navigation without AI analysis", () => {
    const source = read("src/app/(app)/recipes/[id]/cooking/page.tsx");

    expect(source).toContain("Step {selectedStepNumber} of {stepCount}");
    expect(source).toContain("Previous");
    expect(source).toContain("Next");
    const blockedTerms = [["AI", "analysis"].join(" "), ["Analyze", "with", "AI"].join(" "), ["ai", "video", "analysis"].join("_")];
    for (const term of blockedTerms) {
      expect(source.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("grocery detail links to shopping mode", () => {
    expect(read("src/app/(app)/grocery-lists/[id]/page.tsx")).toContain("Shopping Mode");
  });

  it("shopping mode has progress, large checkboxes, and hide-completed toggle", () => {
    const source = read("src/app/(app)/grocery-lists/[id]/shopping/page.tsx");

    expect(source).toContain("checked ·");
    expect(source).toContain("Hide completed");
    expect(source).toContain("h-14 w-14");
  });

  it("core responsive classes are present for mobile build safety", () => {
    const recipe = read("src/app/(app)/recipes/[id]/page.tsx");
    const grocery = read("src/app/(app)/grocery-lists/[id]/shopping/page.tsx");

    expect(recipe).toMatch(/text-base|sm:text-sm/);
    expect(grocery).toContain("sticky top-0");
  });
});
