"use client";

import { useTransition } from "react";

type Props = {
  enabled: boolean;
  action: string;
  hiddenFields: Record<string, string>;
  size?: "sm" | "md";
  disabled?: boolean;
};

export function FeatureToggle({ enabled, action, hiddenFields, size = "md", disabled = false }: Props) {
  const [pending, startTransition] = useTransition();

  const trackW  = size === "sm" ? "w-11" : "w-14";
  const trackH  = size === "sm" ? "h-6"  : "h-7";
  const thumbSz = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const translate = enabled
    ? size === "sm" ? "translate-x-5" : "translate-x-7"
    : "translate-x-1";

  return (
    <form
      action={action}
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => {
          (e.target as HTMLFormElement).requestSubmit();
        });
      }}
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={disabled || pending}
        aria-label={enabled ? "Disable feature" : "Enable feature"}
        title={enabled ? "Click to disable" : "Click to enable"}
        className={[
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
          "transition-all duration-200 ease-in-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          pending ? "opacity-60" : "",
          trackW, trackH,
          enabled
            ? "bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]"
            : "bg-slate-200",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block rounded-full bg-white shadow-md",
            "transition-transform duration-200 ease-in-out",
            thumbSz, translate,
          ].join(" ")}
        />
      </button>
    </form>
  );
}
