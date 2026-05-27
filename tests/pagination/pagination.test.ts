import { describe, expect, it } from "vitest";
import { getPaginationInput, getPaginationMeta, pageHref } from "../../src/lib/pagination";

describe("pagination helpers", () => {
  it("normalizes invalid pages and caps large page sizes", () => {
    expect(getPaginationInput({ page: "-2", pageSize: "500" })).toMatchObject({
      page: 1,
      pageSize: 100,
      skip: 0,
      take: 100,
    });
  });

  it("calculates item ranges and clamps empty totals", () => {
    const input = getPaginationInput({ page: "3", pageSize: "25" });

    expect(getPaginationMeta(61, input)).toMatchObject({
      page: 3,
      pageSize: 25,
      totalItems: 61,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: false,
      startItem: 51,
      endItem: 61,
    });
    expect(getPaginationMeta(0, input)).toMatchObject({
      page: 1,
      totalPages: 1,
      startItem: 0,
      endItem: 0,
    });
  });

  it("preserves filters while creating page links", () => {
    expect(pageHref("/admin/users", { search: "ali", page: "4", countryCode: "US" }, 2)).toBe(
      "/admin/users?search=ali&countryCode=US&page=2",
    );
    expect(pageHref("/admin/users", { search: "ali", countryCode: "US" }, 1)).toBe(
      "/admin/users?search=ali&countryCode=US",
    );
  });
});
