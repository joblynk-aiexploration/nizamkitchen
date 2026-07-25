import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("chef services page", () => {
  it("lets chef users edit existing services and add new services", () => {
    const source = readFileSync("src/app/(app)/chef/services/page.tsx", "utf8");

    expect(source).toContain('name="serviceId"');
    expect(source).toContain("Update service");
    expect(source).toContain("Add service");
    expect(source).toContain("defaultValue={service?.name");
  });
});
