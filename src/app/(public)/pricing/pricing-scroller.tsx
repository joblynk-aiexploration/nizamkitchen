"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PricingPlan } from "./page";

function expandedPlanSequence(plans: PricingPlan[]) {
  if (!plans.length) return [];
  if (plans.length >= 4) return plans;
  const copies: PricingPlan[] = [];
  while (copies.length < 4) {
    copies.push(...plans);
  }
  return copies.slice(0, 4);
}

function PlanCard({ plan, decorative = false }: { plan: PricingPlan; decorative?: boolean }) {
  const isFree = plan.price === "Free";
  const isCustom = plan.price === "Custom";
  const isPopular = plan.isPopular;
  const ctaLabel = plan.cta;
  const periodText = isCustom || isFree ? plan.period : `/${plan.period.replace("per ", "")}`;

  return (
    <article
      data-popular-plan={isPopular ? "true" : undefined}
      className={`relative flex h-[850px] w-[var(--pricing-card-width)] flex-none flex-col overflow-hidden rounded-[1.75rem] p-6 text-slate-950 transition hover:-translate-y-1 sm:p-7 ${
        isPopular
          ? "bg-emerald-100 shadow-[0_28px_95px_rgba(5,150,105,0.32)] hover:shadow-[0_32px_105px_rgba(5,150,105,0.38)]"
          : "bg-white shadow-[0_18px_60px_rgba(15,23,42,0.10)] hover:shadow-[0_24px_85px_rgba(15,118,110,0.14)]"
      }`}
      aria-label={isPopular ? `${plan.name} popular pricing plan` : `${plan.name} pricing plan`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isPopular ? "text-emerald-950" : "text-teal-800"}`}>
          {isCustom ? "Custom" : isFree ? "Starter" : "Self-service"}
        </p>
        <span
          className={`inline-flex shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
            isPopular
              ? "bg-emerald-800 text-white shadow-sm"
              : "bg-emerald-100 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)]"
          }`}
        >
          {isPopular ? "Popular" : plan.audienceLabel}
        </span>
      </div>

      <div className="mt-3">
        <h2 className="text-2xl font-bold leading-tight text-slate-950">{plan.name}</h2>
        <p className="mt-3 max-w-[17rem] text-base leading-7 text-slate-500">
          {plan.description}
        </p>
      </div>

      <div className={`mt-7 rounded-[1.6rem] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${isPopular ? "bg-white/90" : "bg-slate-50/90"}`}>
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-4xl font-black tracking-tight">{plan.price}</span>
          <span className="pb-1 text-sm font-semibold text-slate-500">{periodText}</span>
        </div>
        <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
          {isCustom
            ? "Custom contract and onboarding terms"
            : isFree
              ? "No payment required"
              : "Secure hosted checkout, no card data stored by NizamKitchen"}
        </p>
      </div>

      {plan.keyLimits.length > 0 ? (
        <div className={`mt-5 grid gap-2 rounded-[1.25rem] px-4 py-3 ${isPopular ? "bg-white/80" : "bg-slate-50/70"}`}>
          {plan.keyLimits.slice(0, 4).map((limit) => (
            <p key={`${plan.name}-${limit}`} className="text-xs font-semibold text-slate-600">
              {limit}
            </p>
          ))}
        </div>
      ) : null}

      <ul className="mt-7 grid gap-4">
        {plan.features.slice(0, 10).map((feature) => (
          <li key={`${plan.name}-${feature}`} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full ${
                isPopular ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-800"
              }`}
              aria-hidden="true"
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-7">
        {decorative ? (
          <span
            className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold ${
              isPopular
                ? "bg-emerald-800 text-white shadow-lg shadow-emerald-900/15"
                : "bg-emerald-50 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)]"
            }`}
          >
            {ctaLabel}
          </span>
        ) : (
          <Link
            href={plan.href}
            className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
              isPopular
                ? "bg-emerald-800 text-white shadow-lg shadow-emerald-900/15 hover:bg-emerald-900"
                : "bg-emerald-50 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)] hover:bg-emerald-100"
            }`}
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </article>
  );
}

export function PricingScroller({ plans }: { plans: PricingPlan[] }) {
  const audiences = [
    { value: "household", label: "Household" },
    { value: "chef_staff", label: "Home Chef" },
    { value: "home_catering", label: "Home Catering" },
    { value: "restaurant", label: "Restaurant" },
  ] as const;
  const [activeAudience, setActiveAudience] = useState<PricingPlan["planAudience"]>("household");
  const filteredPlans = useMemo(
    () => plans.filter((plan) => plan.planAudience === activeAudience),
    [activeAudience, plans],
  );
  const sequence = useMemo(() => expandedPlanSequence(filteredPlans), [filteredPlans]);
  const visibleSequence = useMemo(
    () => (sequence.length > 1 ? [...sequence, ...sequence] : sequence),
    [sequence],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  function goToNextPlan() {
    if (sequence.length <= 1) return;
    setTransitionEnabled(true);
    setActiveIndex((currentIndex) => currentIndex >= sequence.length - 1 ? sequence.length : currentIndex + 1);
  }

  function goToPreviousPlan() {
    if (sequence.length <= 1) return;
    if (activeIndex <= 0) {
      setTransitionEnabled(false);
      setActiveIndex(sequence.length - 1);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setTransitionEnabled(true));
      });
      return;
    }
    setTransitionEnabled(true);
    setActiveIndex((currentIndex) => Math.max(0, (currentIndex % sequence.length) - 1));
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (isPaused || prefersReducedMotion || sequence.length <= 1) return;

    const timer = window.setInterval(() => {
      setTransitionEnabled(true);
      setActiveIndex((currentIndex) => currentIndex + 1);
    }, 3800);

    return () => window.clearInterval(timer);
  }, [isPaused, prefersReducedMotion, sequence.length]);

  useEffect(() => {
    if (activeIndex !== sequence.length || sequence.length <= 1) return;

    const resetTimer = window.setTimeout(() => {
      setTransitionEnabled(false);
      setActiveIndex(0);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setTransitionEnabled(true));
      });
    }, 720);

    return () => window.clearTimeout(resetTimer);
  }, [activeIndex, sequence.length]);

  return (
    <section
      aria-label="NizamKitchen pricing plans"
      className="relative overflow-hidden [--pricing-card-width:318px] sm:[--pricing-card-width:386px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="mx-auto mb-5 flex max-w-[calc((var(--pricing-card-width)*3)+3.5rem)] items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto">
          {audiences.map((audience) => (
            <button
              key={audience.value}
              type="button"
              onClick={() => {
                setActiveIndex(0);
                setActiveAudience(audience.value);
              }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                activeAudience === audience.value
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-900"
              }`}
            >
              {audience.label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label="Previous pricing plan"
            onClick={goToPreviousPlan}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-emerald-900 hover:ring-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next pricing plan"
            onClick={goToNextPlan}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-emerald-900 hover:ring-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {sequence.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-950">No plans are available for this account type yet.</p>
        </div>
      ) : null}

      <div className="group relative mx-auto max-w-[calc((var(--pricing-card-width)*3)+3.5rem)] overflow-hidden">
        <div
          className={`flex w-max gap-7 motion-reduce:transform-none ${
            transitionEnabled ? "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" : "transition-none"
          }`}
          style={{
            transform: `translate3d(calc(${activeIndex} * -1 * (var(--pricing-card-width) + 1.75rem)), 0, 0)`,
          }}
        >
          {visibleSequence.map((plan, index) => {
            const isDecorative = index >= sequence.length;

            return (
              <div key={`${plan.name}-${index}`} aria-hidden={isDecorative ? "true" : undefined}>
                <PlanCard plan={plan} decorative={isDecorative} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
