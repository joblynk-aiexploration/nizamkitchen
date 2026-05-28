import { cn } from "@/lib/utils";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
};

export function SelectInput({ label, hint, className, options, ...props }: Props) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
      <span>{label}</span>
      <select
        className={cn(
          "rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition",
          "disabled:bg-slate-100 disabled:text-[var(--text-disabled)]",
          "focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="text-xs font-normal text-[var(--color-muted)]">{hint}</span> : null}
    </label>
  );
}
