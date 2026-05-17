import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  asChild,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/35",
        variant === "primary" &&
          "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-strong)]",
        variant === "secondary" &&
          "border border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-slate-50",
        variant === "ghost" &&
          "bg-transparent text-[var(--color-ink)] hover:bg-slate-100",
        variant === "danger" && "bg-[var(--color-danger)] text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}
