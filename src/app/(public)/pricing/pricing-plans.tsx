"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import type { PricingPlan } from "./page";

const AUDIENCES = [
  { value: "household",     label: "Household"     },
  { value: "chef_staff",    label: "Home Chef"     },
  { value: "home_catering", label: "Catering"      },
  { value: "restaurant",    label: "Restaurant"    },
] as const;

function PlanCard({ plan }: { plan: PricingPlan }) {
  const isFree     = plan.price === "Free";
  const isCustom   = plan.price === "Custom";
  const isPopular  = plan.isPopular;

  const periodDisplay = isFree
    ? "forever"
    : isCustom
      ? ""
      : plan.billingInterval === "yearly"
        ? "/ yr"
        : "/ mo";

  const billingNote = isFree
    ? "No credit card required"
    : isCustom
      ? "Custom contract · bespoke terms"
      : plan.billingInterval === "yearly"
        ? "Billed annually · cancel anytime"
        : "Billed monthly · cancel anytime";

  return (
    <article
      className={[
        "relative flex flex-col overflow-hidden rounded-2xl bg-white",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5",
        isPopular
          ? "ring-1 ring-[var(--color-primary)]/30 shadow-[0_8px_32px_rgba(11,98,92,0.10),0_2px_8px_rgba(15,23,42,0.06)]"
          : "ring-1 ring-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.05)] hover:shadow-[0_6px_24px_rgba(15,23,42,0.09)]",
      ].join(" ")}
      aria-label={`${plan.name} pricing plan`}
    >
      {/* Teal accent bar — 3 px on featured, invisible otherwise */}
      <div
        aria-hidden="true"
        className={[
          "h-[3px] w-full flex-none",
          isPopular
            ? "bg-gradient-to-r from-[var(--color-primary)] via-teal-400 to-[var(--color-primary)]"
            : "bg-transparent",
        ].join(" ")}
      />

      <div className="flex flex-1 flex-col px-6 pb-7 pt-5">
        {/* Plan header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">
              {plan.audienceLabel}
            </p>
            <h3 className="mt-0.5 truncate text-[17px] font-bold leading-snug text-slate-900">
              {plan.name}
            </h3>
          </div>
          {isPopular && (
            <span className="mt-0.5 shrink-0 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
              Recommended
            </span>
          )}
        </div>

        {/* Description */}
        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-slate-500">
          {plan.description}
        </p>

        {/* Price */}
        <div className="mt-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[44px] font-black leading-none tracking-tight text-slate-950">
              {plan.price}
            </span>
            {periodDisplay && (
              <span className="pb-0.5 text-sm font-medium text-slate-400">{periodDisplay}</span>
            )}
          </div>
          {plan.monthlyEquivalent && plan.annualSavingsLabel && (
            <p className="mt-1 text-[12px] font-medium text-[var(--color-primary)]">
              {plan.monthlyEquivalent} · {plan.annualSavingsLabel}
            </p>
          )}
          <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{billingNote}</p>
        </div>

        {/* Primary CTA */}
        <Link
          href={plan.href}
          className={[
            "mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl",
            "py-2.5 text-sm font-semibold",
            "transition-all duration-150 ease-out active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
            isPopular
              ? "bg-[var(--color-primary)] text-white shadow-sm hover:bg-[var(--color-primary-strong)]"
              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          ].join(" ")}
        >
          {plan.cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        {/* Features */}
        <div className="mt-5 border-t border-slate-100 pt-5">
          <ul className="space-y-2.5">
            {plan.features.slice(0, 6).map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check
                  className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--color-primary)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span className="text-[13px] leading-5 text-slate-600">{feature}</span>
              </li>
            ))}
            {plan.features.length > 6 && (
              <li className="pl-6 text-[11px] text-slate-400">
                +{plan.features.length - 6} more features included
              </li>
            )}
          </ul>
        </div>

        {/* Key limits */}
        {plan.keyLimits.length > 0 && (
          <ul className="mt-4 space-y-0.5 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/60">
            {plan.keyLimits.map((limit) => (
              <li key={limit} className="text-[11px] font-medium text-slate-500">
                {limit}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export function PricingPlans({ plans }: { plans: PricingPlan[] }) {
  const [billing,        setBilling]        = useState<"monthly" | "annual">("monthly");
  const [activeAudience, setActiveAudience] = useState<PricingPlan["planAudience"]>("household");

  const byAudience = plans.filter((p) => p.planAudience === activeAudience);

  // Show the billing toggle only when this audience has at least one paid plan.
  // Household is free-only — no toggle needed.
  const hasPaidPlans = byAudience.some((p) => p.price !== "Free" && p.billingInterval !== "custom");

  const displayPlans = byAudience.filter((p) => {
    if (p.price === "Free" || p.billingInterval === "custom") return true;
    return billing === "annual"
      ? p.billingInterval === "yearly"
      : p.billingInterval === "monthly";
  });

  const hasAnnualPlans = byAudience.some((p) => p.billingInterval === "yearly");
  // Only show "Annual coming soon" when there is truly nothing to display in annual mode
  // (free/custom plans always pass the filter and should render regardless of billing toggle)
  const showAnnualPrompt = billing === "annual" && !hasAnnualPlans && displayPlans.length === 0;

  return (
    <div>
      {/* ── Billing toggle — hidden for free-only audiences (e.g. Household) ── */}
      <div className={["mb-8 flex justify-center", hasPaidPlans ? "" : "invisible pointer-events-none"].join(" ")}>
        <div
          className="inline-flex rounded-full bg-slate-100 p-1"
          role="group"
          aria-label="Select billing period"
        >
          {(["monthly", "annual"] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setBilling(period)}
              aria-pressed={billing === period}
              className={[
                "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-slate-100",
                billing === period
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {period === "monthly" ? "Monthly" : "Annual"}
              {period === "annual" && (
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    "transition-colors duration-150",
                    billing === "annual"
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "bg-slate-200 text-slate-500",
                  ].join(" ")}
                >
                  Save 20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Audience tabs ── */}
      <div
        className="mb-10 flex flex-wrap justify-center gap-1.5"
        role="tablist"
        aria-label="Filter plans by account type"
      >
        {AUDIENCES.map((audience) => (
          <button
            key={audience.value}
            type="button"
            role="tab"
            aria-selected={activeAudience === audience.value}
            onClick={() => setActiveAudience(audience.value)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium",
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              activeAudience === audience.value
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
            ].join(" ")}
          >
            {audience.label}
          </button>
        ))}
      </div>

      {/* ── Plans grid or states ── */}
      {showAnnualPrompt ? (
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-900">Annual plans coming soon</p>
          <p className="mt-2 text-sm text-slate-500">
            We&apos;re finalizing annual pricing for{" "}
            {AUDIENCES.find((a) => a.value === activeAudience)?.label} accounts.{" "}
            <Link
              href="/contact?topic=annual-pricing"
              className="text-[var(--color-primary)] underline-offset-2 hover:underline"
            >
              Contact us
            </Link>{" "}
            for early access and volume discounts.
          </p>
        </div>
      ) : displayPlans.length === 0 ? (
        <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            No plans available for this account type yet.{" "}
            <Link
              href="/contact?topic=pricing"
              className="text-[var(--color-primary)] underline-offset-2 hover:underline"
            >
              Contact us
            </Link>
            .
          </p>
        </div>
      ) : (
        <div
          className={[
            "grid gap-5",
            displayPlans.length === 1
              ? "mx-auto max-w-sm"
              : displayPlans.length === 2
                ? "mx-auto max-w-2xl sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          ].join(" ")}
        >
          {displayPlans.map((plan, i) => {
            // 3 plans in a 2-col sm grid: 3rd card orphans. Center it at max-w-sm;
            // reset at lg where the grid becomes 3 equal columns.
            const isOrphan = displayPlans.length === 3 && i === 2;
            return (
              <div
                key={plan.name}
                className={
                  isOrphan
                    ? "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-sm lg:col-span-1 lg:max-w-none"
                    : undefined
                }
              >
                <PlanCard plan={plan} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
