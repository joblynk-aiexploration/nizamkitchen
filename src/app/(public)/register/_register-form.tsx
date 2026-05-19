"use client";

import Link from "next/link";
import { useState } from "react";

type Country = { countryCode: string; countryName: string };
type Cuisine = { id: string; name: string };
type AccountType = "household" | "chef" | "restaurant";

interface Step2Data {
  fullName: string;
  email: string;
  password: string;
  organizationName: string;
  countryCode: string;
}

const accountTypes: { type: AccountType; label: string; description: string; emoji: string }[] = [
  {
    type: "household",
    label: "Household",
    description: "Plan meals, cook real recipes, hire help, and keep an order-in backup.",
    emoji: "🏠",
  },
  {
    type: "chef",
    label: "Home Chef",
    description: "Join the chef waitlist, set up your profile, and prepare for manual verification.",
    emoji: "👨‍🍳",
  },
  {
    type: "restaurant",
    label: "Restaurant Partner",
    description: "Join the partner waitlist so households can discover you without fake ratings.",
    emoji: "🍽️",
  },
];

const spiceLevels = [
  { value: "mild", label: "Mild" },
  { value: "medium", label: "Medium" },
  { value: "hot", label: "Hot" },
  { value: "extra_hot", label: "Extra Hot" },
];

function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all ${i < current ? "bg-[var(--color-primary)]" : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

export function RegisterForm({
  countries,
  cuisines,
  message,
}: {
  countries: Country[];
  cuisines: Cuisine[];
  message?: string;
}) {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);

  const totalSteps = accountType === "household" ? 3 : 2;

  function handleStep2Submit(e: React.FormEvent<HTMLFormElement>) {
    if (accountType !== "household") return; // let native POST handle non-household
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStep2Data({
      fullName: fd.get("fullName") as string,
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      organizationName: fd.get("organizationName") as string,
      countryCode: fd.get("countryCode") as string,
    });
    setStep(3);
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-16 sm:px-8">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-xs font-bold text-white shadow">
          NK
        </div>
        <span className="font-serif text-lg text-[var(--color-ink)]">NizamKitchen</span>
      </Link>

      <h1 className="mt-8 font-serif text-3xl text-[var(--color-ink)]">Create your account</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-primary)]">
          Sign in
        </Link>
      </p>

      <div className="mt-6">
        <Steps current={step} total={totalSteps} />
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {/* ── Step 1: Account type ── */}
      {step === 1 && (
        <div className="mt-8">
          <p className="text-sm font-semibold text-[var(--color-ink)]">I am signing up as a...</p>
          <div className="mt-4 space-y-3">
            {accountTypes.map((at) => (
              <button
                key={at.type}
                type="button"
                onClick={() => { setAccountType(at.type); setStep(2); }}
                className="w-full rounded-2xl border border-[var(--color-border)] p-4 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{at.emoji}</span>
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">{at.label}</p>
                    <p className="text-sm text-[var(--color-muted)]">{at.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Core account details ── */}
      {step === 2 && accountType && (
        <form
          action="/api/auth/register"
          method="post"
          onSubmit={handleStep2Submit}
          className="mt-8 space-y-4"
        >
          <input type="hidden" name="accountType" value={accountType} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              placeholder="Your full name"
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
              Password <span className="text-sm font-normal text-red-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Must include uppercase, lowercase, and a number.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              {accountType === "household"
                ? "Household name"
                : accountType === "chef"
                  ? "Business name"
                  : "Restaurant name"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              name="organizationName"
              required
              minLength={2}
              maxLength={120}
              placeholder={
                accountType === "household"
                  ? "e.g. The Ahmed Family"
                  : accountType === "chef"
                    ? "e.g. Chef Amir's Kitchen"
                    : "e.g. Nizam Biryani House"
              }
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              Country <span className="text-red-500">*</span>
            </label>
            <select
              name="countryCode"
              required
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">Select your country</option>
              {countries.map((c) => (
                <option key={c.countryCode} value={c.countryCode}>
                  {c.countryName} ({c.countryCode})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-2xl border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              {accountType === "household" ? "Continue" : "Create account"}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 3: Household preferences ── */}
      {step === 3 && accountType === "household" && step2Data && (
        <form action="/api/auth/register" method="post" className="mt-8 space-y-4">
          {/* Hidden: forward step 2 data */}
          <input type="hidden" name="accountType" value="household" />
          <input type="hidden" name="fullName" value={step2Data.fullName} />
          <input type="hidden" name="email" value={step2Data.email} />
          <input type="hidden" name="password" value={step2Data.password} />
          <input type="hidden" name="organizationName" value={step2Data.organizationName} />
          <input type="hidden" name="countryCode" value={step2Data.countryCode} />

          <p className="text-sm text-[var(--color-muted)]">
            Tell us about your household so your meal plans, servings, and spice defaults start in the right place.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]">
              Household size
            </label>
            <select
              name="householdSize"
              defaultValue="4"
              className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "person" : "people"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-[var(--color-ink)]">
              Preferred spice level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {spiceLevels.map((s) => (
                <label
                  key={s.value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] p-3 hover:border-[var(--color-primary)]"
                >
                  <input
                    type="radio"
                    name="spiceLevel"
                    value={s.value}
                    defaultChecked={s.value === "medium"}
                  />
                  <span className="text-sm text-[var(--color-ink)]">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {cuisines.length > 0 && (
            <div>
              <label className="mb-3 block text-sm font-medium text-[var(--color-ink)]">
                Preferred cuisines
              </label>
              <div className="space-y-2">
                {cuisines.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] p-3 hover:border-[var(--color-primary)]"
                  >
                    <input type="checkbox" name="cuisineIds" value={c.id} defaultChecked />
                    <span className="text-sm text-[var(--color-ink)]">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-2xl border border-[var(--color-border)] py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-[var(--color-primary)] py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Create account
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
