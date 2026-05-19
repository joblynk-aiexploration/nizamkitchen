import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/layout/logo-mark";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-[linear-gradient(145deg,#f7f9fb_0%,#ebf5f5_50%,#fff3ea_100%)] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden p-10 lg:flex lg:flex-col lg:justify-between">
        <LogoMark />
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
            Plan · Cook · Hire · Order
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-[var(--color-ink)]">
            Your household kitchen, organised at last.
          </h1>
          <p className="mt-6 text-lg text-[var(--color-muted)]">
            Plan authentic Hyderabadi meals, generate grocery lists, hire home chefs,
            and discover local restaurants — all in one place.
          </p>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/60 p-6 backdrop-blur">
          <p className="text-sm text-[var(--color-muted)]">
            Trusted by households, home chefs, and restaurant partners across India, the UK, and beyond.
            Multi-tenant, country-aware, and built for growth.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-8">
        <Card className="w-full max-w-xl">
          <div className="mb-8">
            <h2 className="font-serif text-3xl text-[var(--color-ink)]">{title}</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">{description}</p>
          </div>
          {children}
          <div className="mt-6 border-t border-[var(--color-border)] pt-6 text-sm text-[var(--color-muted)]">
            {footer}
          </div>
        </Card>
      </section>
    </div>
  );
}
