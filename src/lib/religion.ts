export const RELIGION_OPTIONS = [
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "islam", label: "Islam" },
  { value: "hinduism", label: "Hinduism" },
  { value: "christianity", label: "Christianity" },
  { value: "sikhism", label: "Sikhism" },
  { value: "buddhism", label: "Buddhism" },
  { value: "judaism", label: "Judaism" },
  { value: "jainism", label: "Jainism" },
  { value: "other", label: "Other" },
] as const;

export type ReligionValue = (typeof RELIGION_OPTIONS)[number]["value"];

export function formatReligion(value: string | null | undefined) {
  return RELIGION_OPTIONS.find((option) => option.value === value)?.label ?? "Not provided";
}

export function isSupportedReligion(value: string | null | undefined) {
  return !value || RELIGION_OPTIONS.some((option) => option.value === value);
}
