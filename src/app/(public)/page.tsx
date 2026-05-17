import Link from "next/link";
import { ArrowRight, Building2, Globe2, Logs, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const pillars = [
  {
    title: "Tenant isolation by design",
    description:
      "Every future business module will inherit safe organization scoping and reusable authorization helpers.",
    icon: Building2,
  },
  {
    title: "Country-ready operations",
    description:
      "Countries, timezones, currencies, locales, and measurement systems are modeled before feature growth begins.",
    icon: Globe2,
  },
  {
    title: "Enterprise observability",
    description:
      "Authentication, permission checks, admin controls, and auditable events are available from day one.",
    icon: Logs,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <section className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] bg-[linear-gradient(135deg,#10263a_0%,#1d3f5f_60%,#0f766e_100%)] px-8 py-10 text-white shadow-2xl lg:grid-cols-[1.2fr_0.8fr] lg:px-12 lg:py-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
            Phase one foundation
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
            NizamKitchen is now structured as a serious multi-tenant SaaS platform.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-slate-200 sm:text-lg">
            The current release focuses only on enterprise infrastructure: identity,
            organizations, country readiness, feature flags, auditability, billing
            placeholders, and developer operations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="bg-white text-[var(--color-sidebar)] hover:bg-slate-100">
              <Link href="/login">
                Access platform
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="border-white/20 bg-white/8 text-white hover:bg-white/14"
            >
              <Link href="/register">Create workspace</Link>
            </Button>
          </div>
        </div>
        <Card className="border-white/15 bg-white/10 text-white">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-emerald-200" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                Control plane
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Safe by default</h2>
            </div>
          </div>
          <ul className="mt-6 space-y-4 text-sm text-slate-100">
            <li>Custom email and password authentication with database-backed sessions.</li>
            <li>Reusable organization and platform role guards for every server-side query.</li>
            <li>Seeded countries, tenants, users, feature flags, and admin operational surfaces.</li>
          </ul>
        </Card>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <Card key={pillar.title}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{pillar.title}</h3>
              <p className="mt-3 text-sm text-[var(--color-muted)]">{pillar.description}</p>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
