import { normalizeCallingCode, splitPhoneNumber, type PhoneCountryOption } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  hint?: string;
  defaultValue?: string | null;
  options: PhoneCountryOption[];
  countryCodeName?: string;
  nationalNumberName?: string;
  defaultCountryCode?: string;
  className?: string;
  required?: boolean;
};

const fallbackOptions: PhoneCountryOption[] = [
  { countryCode: "US", countryName: "United States", phoneCountryCode: "+1" },
];

export function PhoneNumberInput({
  label = "Phone number",
  hint = "Choose the country code and enter a 10 digit number.",
  defaultValue,
  options,
  countryCodeName = "phoneCountryCode",
  nationalNumberName = "phoneNationalNumber",
  defaultCountryCode = "+1",
  className,
  required = false,
}: Props) {
  const countryOptions = options.length ? options : fallbackOptions;
  const parsed = splitPhoneNumber(defaultValue, defaultCountryCode);
  const selectedCountryCode = countryOptions.some((option) => normalizeCallingCode(option.phoneCountryCode) === parsed.phoneCountryCode)
    ? parsed.phoneCountryCode
    : normalizeCallingCode(countryOptions[0]?.phoneCountryCode ?? defaultCountryCode);

  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-medium text-[var(--color-ink)]">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(150px,0.45fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-2 text-xs font-medium text-[var(--color-muted)]">
          <span>Country code</span>
          <select
            name={countryCodeName}
            defaultValue={selectedCountryCode}
            required={required}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25"
          >
            {countryOptions.map((option) => {
              const value = normalizeCallingCode(option.phoneCountryCode);
              return (
                <option key={`${option.countryCode}-${value}`} value={value}>
                  {value} {option.countryName}
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-medium text-[var(--color-muted)]">
          <span>10 digit number</span>
          <input
            name={nationalNumberName}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="[0-9]{10}"
            minLength={10}
            maxLength={10}
            defaultValue={parsed.phoneNationalNumber}
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
