import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextInput({ label, hint, error, className, ...props }: Props) {
  const showLoginForgotPasswordLink =
    props.name === "password" &&
    props.type === "password" &&
    props.placeholder === "Enter Password";

  const errorId = error && props.name ? `${props.name}-field-error` : undefined;

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
      <span>{label}</span>
      <input
        className={cn(
          "rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition",
          "placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-[var(--text-disabled)]",
          "focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-400/20",
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {showLoginForgotPasswordLink ? (
        <Link
          href="/forgot-password"
          className="-mt-1 self-end text-sm font-semibold text-[var(--color-primary)] transition hover:text-[var(--color-primary-strong)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          Forget Password.
        </Link>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-normal text-rose-600">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-[var(--color-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}
