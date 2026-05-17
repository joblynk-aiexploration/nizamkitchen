export function CountrySelector({
  countries,
  name = "countryCode",
  defaultValue = "",
}: {
  countries: Array<{ countryCode: string; countryName: string }>;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
    >
      <option value="">All countries</option>
      {countries.map((country) => (
        <option key={country.countryCode} value={country.countryCode}>
          {country.countryName} ({country.countryCode})
        </option>
      ))}
    </select>
  );
}
