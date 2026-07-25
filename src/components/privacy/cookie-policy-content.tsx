import Link from "next/link";
import { ManageCookiePreferencesButton } from "@/components/privacy/manage-cookie-preferences-button";

const cookieSections = [
  {
    title: "Essential Cookies",
    body: "NizamKitchen uses essential cookies and similar storage for login sessions, security checks, account routing, CSRF protection, and platform reliability. These are required for the app to work and cannot be disabled through the cookie banner.",
  },
  {
    title: "Preference Cookies",
    body: "Preference cookies may remember choices such as cookie settings, display preferences, regional defaults, and other settings that make NizamKitchen easier to use across visits.",
  },
  {
    title: "Analytics Cookies",
    body: "When enabled, NizamKitchen uses Google Analytics to understand page performance, popular workflows, and product quality. Analytics is configured with Google Analytics measurement ID G-D2668ZZ80C and should respect consent choices provided through Secure Privacy.",
  },
  {
    title: "Consent Management",
    body: "NizamKitchen uses Secure Privacy CMP to present the cookie banner, store consent preferences, and support Google Consent Mode. You can accept, reject, or adjust non-essential categories at any time.",
  },
  {
    title: "Payments And Security",
    body: "Payment and checkout workflows may use cookies or similar browser storage from payment processors for fraud prevention, hosted checkout continuity, and transaction security. NizamKitchen does not use cookies to store full card numbers.",
  },
];

export function CookiePolicyContent() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <article className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
          Back to NizamKitchen
        </Link>
        <div className="mt-8 rounded-3xl border border-[var(--color-border)] bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
            Privacy and consent
          </p>
          <h1 className="mt-3 font-serif text-4xl text-[var(--color-ink)]">Cookie Policy</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--color-ink)]">
            This Cookie Policy explains how NizamKitchen uses cookies and similar browser technologies across meal planning,
            recipes, grocery lists, home chef requests, catering, restaurant ordering, billing, support, analytics, and security.
          </p>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">Manage your choices</p>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Use Secure Privacy to review or update optional analytics and marketing preferences.
            </p>
            <ManageCookiePreferencesButton className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2" />
          </div>

          <div className="mt-8 space-y-7">
            {cookieSections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--color-ink)]">{section.body}</p>
              </section>
            ))}
          </div>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">Your Controls</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-ink)]">
              You can also review privacy settings from the{" "}
              <Link href="/privacy-center" className="font-semibold text-[var(--color-primary)] hover:underline">
                Privacy Center
              </Link>{" "}
              after signing in. Browser settings may also let you block or delete cookies, but some essential NizamKitchen
              features may stop working if required cookies are blocked.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">Contact</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-ink)]">
              Questions about cookies, consent, or privacy may be sent through the{" "}
              <Link href="/contact" className="font-semibold text-[var(--color-primary)] hover:underline">
                contact page
              </Link>{" "}
              or through authenticated support.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
