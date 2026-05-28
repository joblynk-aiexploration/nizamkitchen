export const DEFAULT_DATE_FORMAT = "MM/dd/yyyy";
export const DEFAULT_TIME_FORMAT = "h:mm a";
export const DEFAULT_DATE_TIME_LOCALE = "en-US";

export const DATE_FORMAT_OPTIONS = [
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY" },
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD" },
] as const;

export const TIME_FORMAT_OPTIONS = [
  { value: "h:mm a", label: "12-hour (1:30 PM)" },
] as const;

export function normalizeDateFormat(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  return DATE_FORMAT_OPTIONS.some((option) => option.value === raw) ? raw : DEFAULT_DATE_FORMAT;
}

export function normalizeTimeFormat() {
  return DEFAULT_TIME_FORMAT;
}
