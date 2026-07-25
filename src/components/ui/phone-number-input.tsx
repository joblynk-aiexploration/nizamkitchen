"use client";

import { normalizeCallingCode, sanitizeNationalPhoneNumber, splitPhoneNumber, type PhoneCountryOption } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { SelectInput } from "./select-input";

type Props = {
  label?: string;
  hint?: string;
  defaultValue?: string | null;
  options: PhoneCountryOption[];
  countryCodeName?: string;
  nationalNumberName?: string;
  defaultCountryCode?: string;
  defaultCountryIso?: string;
  className?: string;
  required?: boolean;
};

const fallbackOptions: PhoneCountryOption[] = [
  { countryCode: "US", countryName: "United States", phoneCountryCode: "+1" },
];

export function PhoneNumberInput({
  label = "Phone number",
  hint,
  defaultValue,
  options,
  countryCodeName = "phoneCountryCode",
  nationalNumberName = "phoneNationalNumber",
  defaultCountryCode = "+1",
  defaultCountryIso = "US",
  className,
  required = false,
}: Props) {
  const countryOptions = options.length ? options : fallbackOptions;
  const parsed = splitPhoneNumber(defaultValue, defaultCountryCode);
  const selectedOption =
    countryOptions.find((option) => option.countryCode === defaultCountryIso && normalizeCallingCode(option.phoneCountryCode) === parsed.phoneCountryCode) ??
    countryOptions.find((option) => option.countryCode === "US" && normalizeCallingCode(option.phoneCountryCode) === parsed.phoneCountryCode) ??
    countryOptions.find((option) => normalizeCallingCode(option.phoneCountryCode) === parsed.phoneCountryCode) ??
    countryOptions[0] ??
    fallbackOptions[0];
  const selectedCountryCode = `${normalizeCallingCode(selectedOption.phoneCountryCode)}:${selectedOption.countryCode}`;
  const handleNumberInput = (event: React.FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const sanitized = sanitizeNationalPhoneNumber(input.value);
    if (input.value === sanitized) return;

    input.value = sanitized;
  };

  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-medium text-[var(--color-ink)]">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(150px,0.45fr)_minmax(0,1fr)]">
        <SelectInput
          label="Country code"
          labelClassName="sr-only"
          name={countryCodeName}
          defaultValue={selectedCountryCode}
          required={required}
          options={countryOptions.map((option) => {
            const value = normalizeCallingCode(option.phoneCountryCode);
            return {
              value: `${value}:${option.countryCode}`,
              label: `${value} ${option.countryName}`,
            };
          })}
        />
        <label className="flex flex-col gap-2">
          <span className="sr-only">10 digit number</span>
          <input
            name={nationalNumberName}
            type="text"
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="[0-9]{10}"
            minLength={10}
            maxLength={10}
            defaultValue={parsed.phoneNationalNumber}
            onInput={handleNumberInput}
            required={required}
            placeholder="5551234567"
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-slate-500 focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25"
          />
        </label>
      </div>
      {hint ? <p className="text-xs text-[var(--color-muted)]">{hint}</p> : null}
    </fieldset>
  );
}
