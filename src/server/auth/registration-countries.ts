import { MeasurementSystem, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CORE_REGISTRATION_COUNTRIES = [
  {
    countryCode: "US",
    countryName: "United States",
    currencyCode: "USD",
    defaultTimezone: "America/Chicago",
    defaultLocale: "en-US",
    measurementSystem: MeasurementSystem.imperial,
    phoneCountryCode: "+1",
  },
  {
    countryCode: "IN",
    countryName: "India",
    currencyCode: "INR",
    defaultTimezone: "America/Chicago",
    defaultLocale: "en-IN",
    measurementSystem: MeasurementSystem.metric,
    phoneCountryCode: "+91",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    currencyCode: "GBP",
    defaultTimezone: "America/Chicago",
    defaultLocale: "en-GB",
    measurementSystem: MeasurementSystem.metric,
    phoneCountryCode: "+44",
  },
  {
    countryCode: "SA",
    countryName: "Saudi Arabia",
    currencyCode: "SAR",
    defaultTimezone: "America/Chicago",
    defaultLocale: "ar-SA",
    measurementSystem: MeasurementSystem.metric,
    phoneCountryCode: "+966",
  },
  {
    countryCode: "AE",
    countryName: "United Arab Emirates",
    currencyCode: "AED",
    defaultTimezone: "America/Chicago",
    defaultLocale: "ar-AE",
    measurementSystem: MeasurementSystem.metric,
    phoneCountryCode: "+971",
  },
  {
    countryCode: "CA",
    countryName: "Canada",
    currencyCode: "CAD",
    defaultTimezone: "America/Chicago",
    defaultLocale: "en-CA",
    measurementSystem: MeasurementSystem.metric,
    phoneCountryCode: "+1",
  },
  {
    countryCode: "AU",
    countryName: "Australia",
    currencyCode: "AUD",
    defaultTimezone: "America/Chicago",
    defaultLocale: "en-AU",
    measurementSystem: MeasurementSystem.metric,
    phoneCountryCode: "+61",
  },
] as const;

const countrySelect = {
  countryCode: true,
  countryName: true,
} satisfies Prisma.CountrySelect;

export async function listActiveRegistrationCountries() {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
    select: countrySelect,
  });

  if (countries.length > 0) {
    return countries;
  }

  await ensureCoreRegistrationCountries();

  return prisma.country.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
    select: countrySelect,
  });
}

export async function ensureCoreRegistrationCountries() {
  await Promise.all(
    CORE_REGISTRATION_COUNTRIES.map((country) =>
      prisma.country.upsert({
        where: { countryCode: country.countryCode },
        update: {
          ...country,
          isActive: true,
        },
        create: {
          ...country,
          isActive: true,
          supportedModules: [],
        },
      }),
    ),
  );
}
