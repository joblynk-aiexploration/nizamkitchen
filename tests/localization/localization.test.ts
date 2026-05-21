import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatus, type PlatformRole } from "@prisma/client";

const repoRoot = process.cwd();

const { mockPrisma, recordAdminAuditLog } = vi.hoisted(() => ({
  mockPrisma: {
    localizationLocale: { findMany: vi.fn(), upsert: vi.fn() },
    localizationTranslation: { findMany: vi.fn(), upsert: vi.fn() },
    currencySetting: { findMany: vi.fn(), upsert: vi.fn() },
    countryRegionalSetting: { upsert: vi.fn() },
    foodTerminologyAlias: { findMany: vi.fn(), create: vi.fn() },
    country: { findMany: vi.fn(), update: vi.fn() },
    unit: { findMany: vi.fn() },
    userLocalizationPreference: { findUnique: vi.fn(), upsert: vi.fn() },
    user: { update: vi.fn() },
  },
  recordAdminAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit/audit-service", () => ({ recordAdminAuditLog }));

import {
  INITIAL_LOCALES,
  listLocalizationDashboard,
  parseCsv,
  updateUserLocalizationPreferences,
  upsertCountryRegionalSetting,
  upsertLocale,
} from "@/server/localization/localization-service";

function session(role: PlatformRole | null = "platform_owner") {
  return {
    user: {
      id: "user-1",
      email: "localization-admin@example.test",
      status: UserStatus.active,
      platformRole: role,
      preferredLocale: "en-US",
      preferredTimezone: "America/Chicago",
    },
    countryAssignments: [{ countryCode: "US" }],
    activeOrganization: {
      id: "org-1",
      defaultLocale: "en-US",
      defaultTimezone: "America/Chicago",
      measurementSystem: "imperial",
      currencyCode: "USD",
    },
  } as never;
}

function form(entries: Record<string, string | boolean>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === "boolean") {
      if (value) fd.set(key, "on");
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

describe("localization and regional settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.localizationLocale.findMany.mockResolvedValue([]);
    mockPrisma.currencySetting.findMany.mockResolvedValue([]);
    mockPrisma.country.findMany.mockResolvedValue([]);
    mockPrisma.localizationTranslation.findMany.mockResolvedValue([]);
    mockPrisma.foodTerminologyAlias.findMany.mockResolvedValue([]);
    mockPrisma.localizationLocale.upsert.mockImplementation(async ({ create, update }) => ({ id: "locale-1", localeCode: create.localeCode, ...create, ...update }));
    mockPrisma.countryRegionalSetting.upsert.mockImplementation(async ({ create, update }) => ({ id: "regional-1", ...create, ...update }));
    mockPrisma.userLocalizationPreference.upsert.mockImplementation(async ({ create, update }) => ({ id: "pref-1", ...create, ...update }));
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.country.update.mockResolvedValue({});
  });

  it("seeds the required initial locales including RTL Arabic and Urdu", () => {
    const localeCodes = INITIAL_LOCALES.map((locale) => locale.localeCode);
    expect(localeCodes).toEqual(expect.arrayContaining(["en-US", "en-IN", "en-GB", "ar-SA", "ar-AE", "hi-IN", "ur-IN", "ur-PK"]));
    expect(INITIAL_LOCALES.filter((locale) => locale.textDirection === "rtl").map((locale) => locale.localeCode)).toEqual(
      expect.arrayContaining(["ar-SA", "ar-AE", "ur-IN", "ur-PK"]),
    );
  });

  it("allows Platform Owner to enable or disable locales and logs audit", async () => {
    await upsertLocale(session("platform_owner"), form({
      localeCode: "ar-AE",
      languageName: "Arabic (United Arab Emirates)",
      nativeName: "العربية",
      textDirection: "rtl",
      status: "active",
      dateFormat: "dd/MM/yyyy",
      timeFormat: "HH:mm",
      numberFormat: "ar-AE",
    }));

    expect(mockPrisma.localizationLocale.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { localeCode: "ar-AE" } }));
    expect(recordAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "localization_locale.upserted" }));
  });

  it("blocks non-admin users from managing locales", async () => {
    await expect(upsertLocale(session(null), form({ localeCode: "en-US" }))).rejects.toThrow();
  });

  it("parses country-specific locale and currency CSV settings safely", async () => {
    expect(parseCsv(" en-US, ar-SA ,, ur-PK ")).toEqual(["en-US", "ar-SA", "ur-PK"]);
    await upsertCountryRegionalSetting(session("platform_owner"), form({
      countryCode: "AE",
      defaultLocale: "ar-AE",
      supportedLocales: "en-US, ar-AE, ur-IN",
      supportedCurrencyCodes: "AED, USD",
      measurementSystem: "metric",
      dateFormat: "dd/MM/yyyy",
      timeFormat: "HH:mm",
      addressFormat: "name, addressLine1, city, emirate, country",
      rtlEnabled: true,
    }));

    const call = mockPrisma.countryRegionalSetting.upsert.mock.calls[0][0];
    expect(call.create.supportedLocalesJson).toEqual(["en-US", "ar-AE", "ur-IN"]);
    expect(call.create.supportedCurrencyCodesJson).toEqual(["AED", "USD"]);
    expect(call.create.rtlEnabled).toBe(true);
  });

  it("country managers can view only assigned-country localization dashboard data", async () => {
    await listLocalizationDashboard(session("country_manager"));
    expect(mockPrisma.country.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { countryCode: { in: ["US"] } },
    }));
  });

  it("updates user language, currency, units, and timezone preferences", async () => {
    await updateUserLocalizationPreferences(session(null), form({
      localeCode: "en-IN",
      timezone: "Asia/Kolkata",
      measurementSystem: "metric",
      currencyCode: "INR",
      dateFormat: "dd/MM/yyyy",
      timeFormat: "HH:mm",
    }));

    expect(mockPrisma.userLocalizationPreference.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
    }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ preferredLocale: "en-IN", preferredLanguage: "en", preferredTimezone: "Asia/Kolkata" }),
    }));
  });

  it("adds dedicated admin and user preference routes", () => {
    for (const route of [
      "src/app/(app)/admin/localization/locales/page.tsx",
      "src/app/(app)/admin/localization/translations/page.tsx",
      "src/app/(app)/admin/localization/countries/page.tsx",
      "src/app/(app)/admin/localization/currencies/page.tsx",
      "src/app/(app)/admin/localization/units/page.tsx",
      "src/app/(app)/settings/preferences/page.tsx",
    ]) {
      expect(fs.existsSync(`${repoRoot}/${route}`)).toBe(true);
    }
  });
});
