import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextInput({ label, hint, className, ...props }: Props) {
  const showLoginForgotPasswordLink =
    props.name === "password" &&
    props.type === "password" &&
    props.placeholder === "Enter Password";

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
      <span>{label}</span>
      <input
        className={cn(
          "rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition",
          "placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-[var(--text-disabled)]",
          "focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25",
          className,
        )}
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
      {hint ? <span className="text-xs font-normal text-[var(--color-muted)]">{hint}</span> : null}
    </label>
  );
}
