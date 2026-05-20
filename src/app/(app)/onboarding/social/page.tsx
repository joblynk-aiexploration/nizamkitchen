import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type AccountType = "household" | "chef" | "catering" | "restaurant";

const ACCOUNT_OPTIONS: Array<{
  value: AccountType;
  label: string;
  description: string;
}> = [
  {
    value: "household",
    label: "Household",
    description: "Plan meals, save recipes, and keep grocery lists organized.",
  },
  {
    value: "chef",
    label: "Home Chef",
    description: "Set up your chef profile and prepare for verification.",
  },
  {
    value: "catering",
    label: "Home Catering",
    description: "Sell special dishes for pickup, delivery, and pre-orders.",
  },
  {
    value: "restaurant",
    label: "Restaurant Partner",
    description: "Publish your business profile and menu for households.",
  },
];

function normalizeAccountType(value: string | undefined): AccountType {
  return ACCOUNT_OPTIONS.some((option) => option.value === value)
    ? (value as AccountType)
    : "household";
}

export default async function SocialOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();

  if (session.activeMembership && session.activeOrganization) {
    redirect("/dashboard");
  }

  const [params, countries] = await Promise.all([
    searchParams,
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { countryName: "asc" },
      select: { countryCode: true, countryName: true },
    }),
  ]);

  const message = typeof params.message === "string" ? params.message : undefined;
  const selectedType = normalizeAccountType(
    typeof params.type === "string" ? params.type : undefined,
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-16 sm:px-8">
      <div className="w-full rounded-[2rem] border border-[var(--color-border)] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
          Social sign-in
        </p>
        <h1 className="mt-4 font-serif text-3xl text-[var(--color-ink)]">
          Finish setting up your NizamKitchen account
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          We created your secure sign-in. Now choose the account type you want to
          use on the platform and we’ll provision the right workspace.
        </p>

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <form action="/api/auth/oauth/complete-registration" method="post" className="mt-8 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              Full name
            </label>
            <input
              name="fullName"
              defaultValue={session.user.fullName}
              required
              minLength={2}
              maxLength={120}
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-[var(--color-ink)]">
              I am joining as
            </label>
            <div className="grid gap-3">
              {ACCOUNT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer gap-3 rounded-2xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)]"
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={option.value}
                    defaultChecked={selectedType === option.value}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-[var(--color-ink)]">{option.label}</span>
                    <span className="mt-1 block text-sm text-[var(--color-muted)]">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              Organization or household name
            </label>
            <input
              name="organizationName"
              required
              minLength={2}
              maxLength={120}
              placeholder="Enter your household or business name"
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              Country
            </label>
            <select
              name="countryCode"
              required
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">Select your country</option>
              {countries.map((country) => (
                <option key={country.countryCode} value={country.countryCode}>
                  {country.countryName} ({country.countryCode})
                </option>
              ))}
            </select>
          </div>

          <label className="flex gap-3 rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            <input name="acceptLegalTerms" type="checkbox" required className="mt-1" />
            <span>
              I agree to the required{" "}
              <Link href="/legal/terms" className="font-semibold text-[var(--color-primary)]">
                Terms
              </Link>
              ,{" "}
              <Link href="/legal/privacy" className="font-semibold text-[var(--color-primary)]">
                Privacy Policy
              </Link>
              , and the seller agreements that apply to my account type.
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Complete setup
          </button>
        </form>
      </div>
    </div>
  );
}
