import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link" | "danger" | "destructive" | "success" | "warning";
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:bg-[var(--button-disabled-bg)] disabled:text-[var(--button-disabled-text)] disabled:shadow-none disabled:hover:bg-[var(--button-disabled-bg)]",
        "aria-disabled:bg-[var(--button-disabled-bg)] aria-disabled:text-[var(--button-disabled-text)] aria-disabled:shadow-none",
        variant === "primary" &&
          "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] shadow-sm hover:bg-[var(--button-primary-hover-bg)]",
        variant === "secondary" &&
          "border border-[var(--button-outline-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover-bg)]",
        variant === "outline" &&
          "border border-[var(--button-outline-border)] bg-transparent text-[var(--button-outline-text)] hover:bg-[var(--button-secondary-hover-bg)]",
        variant === "ghost" &&
          "bg-transparent text-[var(--button-ghost-text)] hover:bg-[var(--button-ghost-hover-bg)]",
        variant === "link" &&
          "min-h-0 rounded-md px-0 py-0 text-[var(--text-link)] underline-offset-4 hover:underline focus-visible:ring-offset-0",
        (variant === "danger" || variant === "destructive") &&
          "bg-[var(--button-danger-bg)] text-[var(--button-danger-text)] shadow-sm hover:bg-[#991b1b]",
        variant === "success" &&
          "bg-[var(--button-success-bg)] text-[var(--button-success-text)] shadow-sm hover:bg-[#14532d]",
        variant === "warning" &&
          "bg-[var(--button-warning-bg)] text-[var(--button-warning-text)] shadow-sm hover:bg-[#78350f]",
        className,
      )}
      {...props}
    />
  );
}
