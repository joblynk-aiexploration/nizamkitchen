import { Card } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  children,
  footer,
  variant = "login",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  variant?: "login" | "password-recovery";
}) {
  const panel =
    variant === "password-recovery"
      ? {
          eyebrow: "Account recovery",
          title: "Let’s get you back in.",
          description:
            "Use a secure reset link to update your password and return to your NizamKitchen account.",
          cardTitle: "Secure reset",
          cardDescription:
            "Password reset links are time-limited. If a link expires, you can request a fresh one anytime.",
          formEyebrow: "Recovery",
        }
      : {
          eyebrow: "Plan · Cook · Hire · Order",
          title: "Welcome back.",
          description:
            "Continue planning meals, managing grocery lists, requesting chefs, and keeping your kitchen activity organized.",
          cardTitle: "One account",
          cardDescription:
            "Your saved recipes, orders, support tickets, and profile settings stay connected in one place.",
          formEyebrow: "Login",
        };

  return (
    <div className="overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(21,94,84,0.12),transparent_32%),radial-gradient(circle_at_95%_95%,rgba(212,124,69,0.16),transparent_30%),linear-gradient(145deg,#f8fbfb_0%,#eef7f5_58%,#fff5eb_100%)]">
      <section className="mx-auto flex w-full max-w-6xl justify-center px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="grid w-full gap-6 rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.13)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr] lg:p-6">
          <aside className="relative overflow-hidden rounded-[1.65rem] bg-[linear-gradient(135deg,#172338_0%,#123d42_58%,#176f63_100%)] p-8 text-white sm:p-10 lg:min-h-[30rem]">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" />
            <div className="relative flex min-h-full flex-col justify-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-100">
                  {panel.eyebrow}
                </p>
                <h1 className="mt-8 max-w-sm font-serif text-5xl leading-[1.05] text-white sm:text-6xl">
                  {panel.title}
                </h1>
                <p className="mt-6 max-w-md text-base leading-7 text-slate-200">
                  {panel.description}
                </p>
              </div>
              <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                  {panel.cardTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  {panel.cardDescription}
                </p>
              </div>
            </div>
          </aside>

          <Card className="border-white/80 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8 md:p-9 lg:p-10">
            <div className="mb-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-primary-strong)]">
                {panel.formEyebrow}
              </p>
              <h2 className="font-serif text-4xl leading-tight text-[var(--text-primary)]">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
            </div>
            {children}
            <div className="mt-7 border-t border-[var(--color-border)] pt-6 text-sm text-[var(--text-secondary)]">
              {footer}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
