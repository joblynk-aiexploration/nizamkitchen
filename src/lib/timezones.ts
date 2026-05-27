type CountryTimeZoneSource = {
  countryCode: string;
  countryName?: string | null;
  defaultTimezone?: string | null;
};

export const DEFAULT_APP_TIME_ZONE = "America/Chicago";

export type TimeZoneOption = {
  value: string;
  label: string;
  countryCode?: string;
};

const COUNTRY_TIME_ZONES: Record<string, string[]> = {
  AE: ["Asia/Dubai"],
  AU: [
    "Australia/Perth",
    "Australia/Eucla",
    "Australia/Darwin",
    "Australia/Adelaide",
    "Australia/Brisbane",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Hobart",
    "Australia/Broken_Hill",
    "Australia/Lord_Howe",
  ],
  CA: [
    "America/Vancouver",
    "America/Whitehorse",
    "America/Dawson",
    "America/Edmonton",
    "America/Yellowknife",
    "America/Inuvik",
    "America/Regina",
    "America/Winnipeg",
    "America/Rankin_Inlet",
    "America/Toronto",
    "America/Iqaluit",
    "America/Halifax",
    "America/Glace_Bay",
    "America/Goose_Bay",
    "America/St_Johns",
  ],
  GB: ["Europe/London"],
  IN: ["Asia/Kolkata"],
  PK: ["Asia/Karachi"],
  SA: ["Asia/Riyadh"],
  US: [
    "America/New_York",
    "America/Detroit",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "America/Adak",
    "Pacific/Honolulu",
    "America/Puerto_Rico",
    "Pacific/Guam",
    "Pacific/Pago_Pago",
  ],
};

function cleanCountryCode(countryCode: string | null | undefined) {
  return countryCode?.trim().toUpperCase() ?? "";
}

function prettyTimeZoneName(timeZone: string) {
  const parts = timeZone.split("/");
  return (parts.at(-1) ?? timeZone).replaceAll("_", " ");
}

function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getKnownTimeZonesForCountry(countryCode: string | null | undefined, defaultTimezone?: string | null) {
  const normalizedCountryCode = cleanCountryCode(countryCode);
  const values = new Set<string>();

  if (defaultTimezone && isValidTimeZone(defaultTimezone)) {
    values.add(defaultTimezone);
  }

  for (const timeZone of COUNTRY_TIME_ZONES[normalizedCountryCode] ?? []) {
    if (isValidTimeZone(timeZone)) {
      values.add(timeZone);
    }
  }

  return Array.from(values).sort((a, b) => prettyTimeZoneName(a).localeCompare(prettyTimeZoneName(b)));
}

export function getTimeZoneOptionsForCountries(countries: CountryTimeZoneSource[]) {
  const options = new Map<string, TimeZoneOption>();

  for (const country of countries) {
    const countryCode = cleanCountryCode(country.countryCode);
    for (const timeZone of getKnownTimeZonesForCountry(countryCode, country.defaultTimezone)) {
      if (!options.has(timeZone)) {
        options.set(timeZone, {
          value: timeZone,
          label: `${country.countryName ?? countryCode} - ${prettyTimeZoneName(timeZone)} (${timeZone})`,
          countryCode,
        });
      }
    }
  }

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function getAllKnownTimeZoneOptions() {
  const countries = Object.entries(COUNTRY_TIME_ZONES).map(([countryCode, timeZones]) => ({
    countryCode,
    countryName: countryCode,
    defaultTimezone: timeZones[0],
  }));

  return getTimeZoneOptionsForCountries(countries);
}
