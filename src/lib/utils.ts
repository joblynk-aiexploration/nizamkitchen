import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_APP_TIME_ZONE } from "@/lib/timezones";
import { DEFAULT_DATE_TIME_LOCALE } from "@/lib/date-time-formats";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DEFAULT_APP_TIME_ZONE,
    hour12: true,
  }).format(new Date(value));
}

export function formatAppDate(value: Date | string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat(DEFAULT_DATE_TIME_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: DEFAULT_APP_TIME_ZONE,
  }).format(new Date(value));
}

// Use for calendar-day dates (subscription periods, expiry dates) stored as UTC midnight.
// UTC avoids off-by-one when the app timezone is behind UTC (e.g. Dec 25 00:00 UTC → Dec 24 CT).
export function formatCalendarDate(value: Date | string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatAppDateTime(value: Date | string | null | undefined, { showTimeZone = false } = {}) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(DEFAULT_DATE_TIME_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: DEFAULT_APP_TIME_ZONE,
    ...(showTimeZone ? { timeZoneName: "short" as const } : {}),
  }).format(new Date(value));
}

export function titleCase(input: string) {
  return input
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
