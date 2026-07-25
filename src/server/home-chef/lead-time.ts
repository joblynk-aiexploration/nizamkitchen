import type { HomeChefLeadTimeCategory, HomeChefRequestType } from "@prisma/client";

export const HOME_CHEF_ACCEPTANCE_WINDOWS_MINUTES: Record<HomeChefLeadTimeCategory, number> = {
  advance_booking: 24 * 60,
  short_term: 3 * 60,
  same_day: 30,
  recurring: 12 * 60,
  custom: 24 * 60,
};

export const HOME_CHEF_LEAD_TIME_LABELS: Record<HomeChefLeadTimeCategory, string> = {
  advance_booking: "Advance booking",
  short_term: "Short-term request",
  same_day: "Same-day request",
  recurring: "Recurring cooking",
  custom: "Manual review",
};

const RECURRING_REQUEST_TYPES = new Set<HomeChefRequestType>(["weekly_cooking", "daily_cooking"]);

function parseRequestedServiceAt(requestedDate: Date | string | null | undefined, requestedTimeWindow?: string | null) {
  if (!requestedDate) return null;

  const date = requestedDate instanceof Date ? requestedDate : new Date(requestedDate);
  if (Number.isNaN(date.getTime())) return null;

  const timeMatch = requestedTimeWindow?.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const serviceAt = new Date(date);
  if (timeMatch) {
    serviceAt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return serviceAt;
}

export function getHomeChefLeadTimeCategory(params: {
  requestType: HomeChefRequestType;
  requestedDate?: Date | string | null;
  requestedTimeWindow?: string | null;
  now?: Date;
}): HomeChefLeadTimeCategory {
  if (RECURRING_REQUEST_TYPES.has(params.requestType)) {
    return "recurring";
  }

  const now = params.now ?? new Date();
  const serviceAt = parseRequestedServiceAt(params.requestedDate, params.requestedTimeWindow);
  if (!serviceAt) return "custom";

  const hoursUntilService = (serviceAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilService < 0) return "custom";
  if (hoursUntilService < 12) return "same_day";
  if (hoursUntilService >= 24 && hoursUntilService <= 72) return "short_term";
  if (hoursUntilService >= 24 * 7) return "advance_booking";
  return "custom";
}

export function getDefaultHomeChefAcceptanceWindowMinutes(category: HomeChefLeadTimeCategory) {
  return HOME_CHEF_ACCEPTANCE_WINDOWS_MINUTES[category] ?? HOME_CHEF_ACCEPTANCE_WINDOWS_MINUTES.custom;
}

export function calculateHomeChefAcceptanceDeadline(now: Date, acceptanceWindowMinutes: number) {
  return new Date(now.getTime() + acceptanceWindowMinutes * 60 * 1000);
}

export function formatHomeChefResponseWindow(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.round(hours * 10) / 10} hours`;
}
