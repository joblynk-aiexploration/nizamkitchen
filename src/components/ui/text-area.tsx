import { cn } from "@/lib/utils";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export function TextArea({ label, hint, className, ...props }: Props) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
      <span>{label}</span>
      <textarea
        className={cn(
          "min-h-28 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm outline-none transition",
          "focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10",
          className,
        )}
        {...props}
      />
      {hint ? <span className="text-xs font-normal text-[var(--color-muted)]">{hint}</span> : null}
    </label>
  );
}
