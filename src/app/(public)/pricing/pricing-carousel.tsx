"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PricingPlan = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  href: string;
  highlight: boolean;
  badge: string;
  features: string[];
};

export function PricingCarousel({ plans }: { plans: PricingPlan[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  function goTo(index: number) {
    const nextIndex = (index + plans.length) % plans.length;
    setActiveIndex(nextIndex);
  }

  useEffect(() => {
    cardRefs.current[activeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex]);

  useEffect(() => {
    if (isPaused || plans.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % plans.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [isPaused, plans.length]);

  return (
    <section
      aria-label="NizamKitchen pricing plans"
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">Slide through plans</p>
          <p className="text-sm text-[var(--color-muted)]">Every plan shows its included benefits with checkmarks.</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button type="button" variant="outline" aria-label="Previous pricing plan" onClick={() => goTo(activeIndex - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" aria-label="Next pricing plan" onClick={() => goTo(activeIndex + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-10 left-0 top-16 z-10 hidden w-20 bg-gradient-to-r from-[#f4f7fa] to-transparent lg:block" />
      <div className="pointer-events-none absolute bottom-10 right-0 top-16 z-10 hidden w-20 bg-gradient-to-l from-[#f4f7fa] to-transparent lg:block" />

      <div
        className="
          flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4
          [scrollbar-width:none]
          [-ms-overflow-style:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {plans.map((plan, index) => (
          <article
            key={plan.name}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className={cn(
              "relative flex min-h-[640px] min-w-[305px] snap-center flex-col rounded-[2rem] border p-7 shadow-sm transition-all duration-300 sm:min-w-[340px] lg:min-w-[365px]",
              index === activeIndex ? "scale-[1.01] shadow-2xl" : "opacity-90 hover:opacity-100",
              plan.highlight
                ? "border-[var(--color-primary)] bg-[linear-gradient(155deg,#0b5f5a,#123f5f)] text-white ring-2 ring-[var(--color-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-card)]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
                  plan.highlight
                    ? "border border-white/30 bg-white/15 text-white"
                    : "bg-[var(--color-card-alt)] text-[var(--color-muted)]",
                )}
              >
                {plan.badge}
              </span>
              {index === activeIndex ? (
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", plan.highlight ? "bg-white text-[var(--color-primary)]" : "bg-emerald-100 text-emerald-800")}>
                  Viewing
                </span>
              ) : null}
            </div>

            <h2 className={cn("mt-7 font-serif text-2xl", plan.highlight ? "text-white" : "text-[var(--color-ink)]")}>
              {plan.name}
            </h2>
            <p className={cn("mt-3 min-h-[72px] text-sm leading-6", plan.highlight ? "text-slate-100" : "text-[var(--color-muted)]")}>
              {plan.description}
            </p>

            <div className="mt-5">
              <div className="flex items-end gap-1">
                <span className={cn("text-4xl font-semibold leading-tight", plan.highlight ? "text-white" : "text-[var(--color-ink)]")}>
                  {plan.price}
                </span>
                <span className={cn("mb-1 text-sm", plan.highlight ? "text-white/75" : "text-[var(--color-muted)]")}>
                  / {plan.period}
                </span>
              </div>
              <p className={cn("mt-1 text-xs", plan.highlight ? "text-white/65" : "text-[var(--color-muted)]")}>
                per billed period
              </p>
            </div>

            <Link
              href={plan.href}
              className={cn(
                "mt-7 inline-flex w-full justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
                plan.highlight
                  ? "bg-white text-[var(--color-primary)] hover:bg-slate-100 focus-visible:ring-offset-[#0b5f5a]"
                  : "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-ink)] hover:bg-slate-50 focus-visible:ring-offset-white",
              )}
            >
              {plan.cta}
            </Link>

            <ul className="mt-8 grid gap-3">
              {plan.features.map((feature) => (
                <li key={`${plan.name}-${feature}`} className="flex items-start gap-3 text-sm leading-6">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full",
                      plan.highlight ? "bg-white text-[var(--color-primary)]" : "bg-emerald-100 text-emerald-700",
                    )}
                    aria-hidden="true"
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                  <span className={plan.highlight ? "text-white/90" : "text-[var(--color-muted)]"}>{feature}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {plans.map((plan, index) => (
          <button
            key={plan.name}
            type="button"
            aria-label={`Show ${plan.name}`}
            aria-current={activeIndex === index ? "true" : undefined}
            onClick={() => goTo(index)}
            className={cn(
              "h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              activeIndex === index ? "w-9 bg-[var(--color-primary)]" : "w-2.5 bg-slate-300 hover:bg-slate-400",
            )}
          />
        ))}
      </div>
    </section>
  );
}
