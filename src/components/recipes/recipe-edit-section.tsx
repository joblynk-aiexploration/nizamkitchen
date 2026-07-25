"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type RecipeEditSectionProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function RecipeEditSection({
  title,
  eyebrow,
  description,
  meta,
  defaultOpen = false,
  children,
}: RecipeEditSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-emerald-50 px-5 py-4 text-left transition hover:from-emerald-50 hover:to-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] sm:px-6"
      >
        <span className="min-w-0">
          {eyebrow ? (
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
              {eyebrow}
            </span>
          ) : null}
          <span className="mt-1 block text-lg font-semibold tracking-tight text-[var(--color-ink)] sm:text-xl">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
              {description}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {meta ? (
            <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-[var(--color-border)] sm:inline-flex">
              {meta}
            </span>
          ) : null}
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--color-primary)] ring-1 ring-[var(--color-border)]">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-[var(--color-border)] p-5 sm:p-6">
          {children}
        </div>
      ) : null}
    </section>
  );
}
