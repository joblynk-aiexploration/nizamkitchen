const SERVING_UNIT_OPTIONS = [
  { value: "serving", label: "Serving" },
  { value: "person", label: "Person" },
  { value: "portion", label: "Portion" },
  { value: "plate", label: "Plate" },
  { value: "bowl", label: "Bowl" },
  { value: "piece", label: "Piece" },
  { value: "cup", label: "Cup" },
  { value: "tray", label: "Tray" },
  { value: "family pack", label: "Family pack" },
  { value: "batch", label: "Batch" },
  { value: "dozen", label: "Dozen" },
] as const;

export function ServingUnitSelect({
  defaultValue = "serving",
}: {
  defaultValue?: string | null;
}) {
  const selectedValue = defaultValue?.trim() || "serving";
  const hasSelectedValue = SERVING_UNIT_OPTIONS.some((option) => option.value === selectedValue);

  return (
    <select
      id="servingUnit"
      name="servingUnit"
      defaultValue={selectedValue}
      className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
    >
      {!hasSelectedValue ? (
        <option value={selectedValue}>
          {selectedValue}
        </option>
      ) : null}
      {SERVING_UNIT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
