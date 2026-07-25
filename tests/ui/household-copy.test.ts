import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("household-facing copy", () => {
  it("uses household/workspace language in recipe visibility instead of organization jargon", () => {
    const newRecipePage = read("src/app/(app)/recipes/new/page.tsx");
    const recipesPage = read("src/app/(app)/recipes/page.tsx");

    expect(newRecipePage).toContain("Who can see this recipe?");
    expect(newRecipePage).toContain("My household");
    expect(newRecipePage).toContain("Workspace only");
    expect(newRecipePage).not.toContain("Organization only");
    expect(recipesPage).toContain("Global Recipe Templates");
    expect(recipesPage).toContain("Add a template to My Recipes before customizing your household version.");
    expect(recipesPage).not.toContain("organization recipes");
  });

  it("keeps household preference pages free of organization-facing labels", () => {
    const preferencesPage = read("src/app/(app)/household/preferences/page.tsx");
    const favoritesPage = read("src/app/(app)/household/favorites/page.tsx");
    const householdComponents = read("src/app/(app)/household/_components.tsx");

    expect(preferencesPage).toContain("regional defaults for your household");
    expect(favoritesPage).toContain("Recipes your household wants to find quickly");
    expect(householdComponents).toContain("Workspace type");
    expect(preferencesPage).not.toContain("for this organization");
    expect(favoritesPage).not.toContain("Organization-scoped");
  });
});
