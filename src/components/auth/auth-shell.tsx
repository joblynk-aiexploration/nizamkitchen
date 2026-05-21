import { Card } from "@/components/ui/card";

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
    <div className="grid min-h-[calc(100svh-4rem)] bg-[linear-gradient(145deg,#f7f9fb_0%,#ebf5f5_50%,#fff3ea_100%)] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden p-10 lg:flex lg:flex-col lg:justify-center lg:gap-10">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary-strong)]">
            Plan · Cook · Hire · Order
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-[var(--text-primary)]">
            Your household kitchen, organised at last.
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--text-secondary)]">
            Plan authentic Hyderabadi meals, generate grocery lists, hire home chefs,
            and discover local restaurants — all in one place.
          </p>
        </div>
        <div className="max-w-xl rounded-3xl border border-[var(--color-border)] bg-white/80 p-6 shadow-sm backdrop-blur">
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            Trusted by households, home chefs, and restaurant partners across India, the UK, and beyond.
            Multi-tenant, country-aware, and built for growth.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 py-10 sm:p-8">
        <Card className="w-full max-w-xl">
          <div className="mb-8">
            <h2 className="font-serif text-3xl text-[var(--text-primary)]">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
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
