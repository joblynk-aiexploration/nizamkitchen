import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  labelClassName?: string;
  hint?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
};

export function SelectInput({ label, labelClassName, hint, error, className, options, ...props }: Props) {
  const errorId = error && props.name ? `${props.name}-field-error` : undefined;

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
      <span className={labelClassName}>{label}</span>
      <span className="relative block">
        <select
          className={cn(
            "w-full appearance-none rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] py-3 pl-4 pr-12 text-sm text-[var(--text-primary)] outline-none transition",
            "disabled:bg-slate-100 disabled:text-[var(--text-disabled)]",
            "focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25",
            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-400/20",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]"
          strokeWidth={2}
        />
      </span>
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-normal text-rose-600">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-[var(--color-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}
