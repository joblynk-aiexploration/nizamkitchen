import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin country form stability", () => {
  it("uses post-save redirects and displays success or error messages", () => {
    const createRoute = readFileSync("src/app/api/admin/countries/route.ts", "utf8");
    const updateRoute = readFileSync("src/app/api/admin/countries/[code]/route.ts", "utf8");
    const listPage = readFileSync("src/app/(app)/admin/countries/page.tsx", "utf8");
    const newPage = readFileSync("src/app/(app)/admin/countries/new/page.tsx", "utf8");
    const detailPage = readFileSync("src/app/(app)/admin/countries/[code]/page.tsx", "utf8");

    expect(createRoute).toContain("{ status: 303 }");
    expect(updateRoute).toContain("{ status: 303 }");
    expect(createRoute).toContain("was created successfully");
    expect(updateRoute).toContain("Country settings were saved successfully");
    expect(listPage).toContain("<FormMessage message={params.message} />");
    expect(newPage).toContain("<FormMessage message={params.message} />");
    expect(detailPage).toContain("<FormMessage message={query.message} />");
  });

  it("prevents measurement-system typos on create and edit country forms", () => {
    const newPage = readFileSync("src/app/(app)/admin/countries/new/page.tsx", "utf8");
    const detailPage = readFileSync("src/app/(app)/admin/countries/[code]/page.tsx", "utf8");

    expect(newPage).toContain('<select name="measurementSystem"');
    expect(detailPage).toContain('<select name="measurementSystem"');
    expect(newPage).toContain('<option value="imperial">Imperial</option>');
    expect(detailPage).toContain('<option value="metric">Metric</option>');
  });

  it("lets platform operators manage country activation from the console", () => {
    const listPage = readFileSync("src/app/(app)/admin/countries/page.tsx", "utf8");
    const detailPage = readFileSync("src/app/(app)/admin/countries/[code]/page.tsx", "utf8");
    const countryService = readFileSync("src/server/admin/countries.ts", "utf8");

    expect(listPage).toContain("canManageCountries");
    expect(listPage).toContain(">Manage</Link>");
    expect(listPage).toContain('{country.isActive ? "Disable" : "Enable"}');
    expect(listPage).toContain('name="isActive" value="on"');
    expect(detailPage).toContain("canManageCountryActivation");
    expect(detailPage).toContain("Platform Admin can enable or disable country availability");
    expect(countryService).toContain("filters?: { query?: string; onlyActive?: string; countryCode?: string; page?: string | string[] | number; pageSize?: string | string[] | number }");
    expect(countryService).toContain("filters?.countryCode && !isCountryManager");
  });
});
