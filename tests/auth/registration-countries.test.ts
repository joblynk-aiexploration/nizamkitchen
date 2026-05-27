import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    country: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  CORE_REGISTRATION_COUNTRIES,
  listActiveRegistrationCountries,
} from "@/server/auth/registration-countries";

describe("registration country options", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("bootstraps core countries when production has no active countries seeded", async () => {
    mockPrisma.country.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { countryCode: "US", countryName: "United States" },
        { countryCode: "IN", countryName: "India" },
      ]);
    mockPrisma.country.upsert.mockResolvedValue({});

    const countries = await listActiveRegistrationCountries();

    expect(mockPrisma.country.upsert).toHaveBeenCalledTimes(CORE_REGISTRATION_COUNTRIES.length);
    expect(countries).toEqual([
      { countryCode: "US", countryName: "United States" },
      { countryCode: "IN", countryName: "India" },
    ]);
  });

  it("does not modify countries when active options already exist", async () => {
    mockPrisma.country.findMany.mockResolvedValueOnce([
      { countryCode: "US", countryName: "United States" },
    ]);

    const countries = await listActiveRegistrationCountries();

    expect(mockPrisma.country.upsert).not.toHaveBeenCalled();
    expect(countries).toEqual([{ countryCode: "US", countryName: "United States" }]);
  });
});
