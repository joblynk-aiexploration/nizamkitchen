"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type UpgradePlanOption = {
  slug: string;
  name: string;
  tier: string;
  billingInterval: "monthly" | "yearly" | "custom";
  priceAmount: number;
  featuresJson: string[];
};

export function UpgradeModal({
  trigger,
  currentPlanName,
  limitLabel,
  current,
  limit,
  upgradePlans,
}: {
  trigger: React.ReactNode;
  currentPlanName: string;
  limitLabel: string;
  current: number;
  limit: number;
  upgradePlans: UpgradePlanOption[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const monthly = upgradePlans.find((p) => p.billingInterval === "monthly");
  const yearly = upgradePlans.find((p) => p.billingInterval === "yearly");
  const benefits = monthly?.featuresJson ?? yearly?.featuresJson ?? [];
  const upgradeName = monthly?.name ?? yearly?.name;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="contents"
        aria-haspopup="dialog"
      >
        {trigger}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-lg rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-0 shadow-2xl backdrop:bg-black/40 open:flex open:flex-col"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">Upgrade your plan</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                You&apos;ve reached a limit on your current plan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-xl leading-none text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-alt)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current plan</p>
            <p className="font-semibold text-[var(--color-ink)]">{currentPlanName}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--color-muted)]">{limitLabel}:</span>
              <span className="font-semibold text-[var(--color-danger)]">
                {current} / {limit === Infinity ? "∞" : limit}
              </span>
              <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-medium text-[var(--color-danger)]">
                Limit reached
              </span>
            </div>
          </div>

          {upgradePlans.length > 0 ? (
            <div className="space-y-4">
              {upgradeName && (
                <p className="text-sm font-semibold text-[var(--color-ink)]">{upgradeName} plan includes:</p>
              )}
              <ul className="space-y-1.5">
                {benefits.slice(0, 6).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
                    <span className="mt-0.5 shrink-0 text-[var(--color-primary)]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-2 gap-3">
                {monthly && monthly.priceAmount > 0 && (
                  <div className="rounded-2xl border border-[var(--color-border)] p-3 text-center">
                    <p className="text-xs text-[var(--color-muted)]">Monthly</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--color-ink)]">${monthly.priceAmount}</p>
                    <p className="text-xs text-[var(--color-muted)]">per month</p>
                  </div>
                )}
                {yearly && yearly.priceAmount > 0 && (
                  <div className="rounded-2xl border border-[var(--color-primary)] bg-emerald-50/60 p-3 text-center">
                    <p className="text-xs font-medium text-[var(--color-primary)]">Annual · save ~20%</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--color-ink)]">${yearly.priceAmount}</p>
                    <p className="text-xs text-[var(--color-muted)]">per year</p>
                  </div>
                )}
              </div>

              <Button asChild className="w-full">
                <Link href="/billing/plans">View plans & upgrade</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-muted)]">
                You&apos;re on our highest available plan. Contact us to discuss custom enterprise terms.
              </p>
              <Button asChild className="w-full">
                <Link href="/billing/plans">View your plan</Link>
              </Button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
