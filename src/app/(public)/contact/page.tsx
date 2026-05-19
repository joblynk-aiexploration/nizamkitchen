import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;

  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
    select: { countryCode: true, countryName: true },
  });

  const isSuccess = message?.startsWith("Thank you");

  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Left panel */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Get in touch
            </p>
            <h1 className="mt-4 font-serif text-4xl text-[var(--color-ink)]">
              We&apos;d love to hear from you.
            </h1>
            <p className="mt-5 text-[var(--color-muted)]">
              Whether you&apos;re a household, a home chef, or a restaurant — reach out and our team will
              get back to you within one business day.
            </p>
            <div className="mt-10 space-y-4">
              <div className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="text-sm font-semibold text-[var(--color-ink)]">Households</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Questions about meal planning, recipes, or your account.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="text-sm font-semibold text-[var(--color-ink)]">Home Chefs</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Interested in joining the chef marketplace or need help with your profile.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="text-sm font-semibold text-[var(--color-ink)]">Restaurants</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Partnership enquiries, city availability, and commercial terms.
                </p>
              </div>
            </div>
          </div>

          {/* Right panel — form */}
          <div className="rounded-3xl border border-[var(--color-border)] p-8">
            {isSuccess ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                  ✓
                </div>
                <h2 className="mt-6 font-serif text-2xl text-[var(--color-ink)]">Message received!</h2>
                <p className="mt-3 text-sm text-[var(--color-muted)]">
                  Thank you for reaching out. We&apos;ll get back to you shortly.
                </p>
              </div>
            ) : (
              <>
                {message && !isSuccess && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {message}
                  </div>
                )}
                <form action="/api/contact" method="post" className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
                      I am a...
                    </label>
                    <select
                      name="organizationType"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    >
                      <option value="">Select (optional)</option>
                      <option value="household">Household / Family</option>
                      <option value="chef">Home Chef</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
                      Country
                    </label>
                    <select
                      name="countryCode"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    >
                      <option value="">Select (optional)</option>
                      {countries.map((c) => (
                        <option key={c.countryCode} value={c.countryCode}>
                          {c.countryName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="message"
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={5}
                      placeholder="Tell us what you need..."
                      className="w-full resize-none rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Send message
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
