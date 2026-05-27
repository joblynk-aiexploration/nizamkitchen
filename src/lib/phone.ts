export type PhoneCountryOption = {
  countryCode: string;
  countryName: string;
  phoneCountryCode: string;
};

const PHONE_FORMAT = /^\+\d{1,4} \d{10}$/;

function digitsOnly(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeCallingCode(value: FormDataEntryValue | string | null | undefined) {
  const digits = digitsOnly(value);
  return digits ? `+${digits.slice(0, 4)}` : "";
}

export function normalizePhoneParts(params: {
  phoneCountryCode?: FormDataEntryValue | string | null;
  phoneNationalNumber?: FormDataEntryValue | string | null;
}) {
  const countryCode = normalizeCallingCode(params.phoneCountryCode);
  const nationalNumber = digitsOnly(params.phoneNationalNumber);

  if (!nationalNumber) return null;
  if (!countryCode) throw new Error("Choose a phone country code.");
  if (nationalNumber.length !== 10) {
    throw new Error("Enter a 10 digit phone number.");
  }

  return `${countryCode} ${nationalNumber}`;
}

export function normalizePhoneFromForm(
  formData: FormData,
  fields: { countryCodeName?: string; nationalNumberName?: string } = {},
) {
  return normalizePhoneParts({
    phoneCountryCode: formData.get(fields.countryCodeName ?? "phoneCountryCode"),
    phoneNationalNumber: formData.get(fields.nationalNumberName ?? "phoneNationalNumber"),
  });
}

export function isFormattedPhoneNumber(value: string | null | undefined) {
  return !value || PHONE_FORMAT.test(value);
}

export function splitPhoneNumber(value: string | null | undefined, fallbackCountryCode = "+1") {
  const trimmed = String(value ?? "").trim();
  const formatted = trimmed.match(/^(\+\d{1,4})\s+(\d{10})$/);
  if (formatted) {
    return { phoneCountryCode: formatted[1], phoneNationalNumber: formatted[2] };
  }

  const digits = digitsOnly(trimmed);
  if (digits.length > 10) {
    return {
      phoneCountryCode: normalizeCallingCode(digits.slice(0, digits.length - 10)),
      phoneNationalNumber: digits.slice(-10),
    };
  }

  return {
    phoneCountryCode: normalizeCallingCode(fallbackCountryCode) || "+1",
    phoneNationalNumber: digits.length === 10 ? digits : "",
  };
}
