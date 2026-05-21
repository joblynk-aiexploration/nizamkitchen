import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, ChefHat, Star } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/public-page-metadata";

export const generateMetadata = () => publicPageMetadata("/for-chefs");

const benefits = [
  {
    icon: ChefHat,
    title: "Your professional profile",
    body: "Create a rich chef profile with your specialties, experience, photo, service areas, and the cuisines you cook best.",
  },
  {
    icon: CalendarDays,
    title: "Manage your calendar",
    body: "Set services and availability for manual requests. Full live scheduling and payments are not enabled yet.",
  },
  {
    icon: Star,
    title: "Build your reputation",
    body: "Build trust through profile quality, specialties, and household request history as the beta marketplace grows.",
  },
  {
    icon: BarChart3,
    title: "Track your business",
    body: "Track requests, profile details, services, and reviews from one dashboard built for culinary professionals.",
  },
];

export default function ForChefsPage() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero */}
        <div className="rounded-3xl bg-[linear-gradient(145deg,#10263a_0%,#1d3f5f_60%,#0f766e_100%)] px-8 py-16 text-white">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              For home chefs
            </p>
            <h1 className="mt-4 font-serif text-4xl sm:text-5xl">
              Turn your cooking passion into a business.
            </h1>
            <p className="mt-5 text-lg text-slate-200">
              NizamKitchen connects verified home chefs with households who want authentic, restaurant-quality
              food cooked in their own home. Build your profile, receive manual requests, and grow your brand during beta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register?type=chef"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#10263a] shadow-sm transition hover:bg-slate-100"
              >
                Join as chef
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/50 bg-white/15 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-white hover:text-[#10263a]"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="rounded-3xl border border-[var(--color-border)] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-[var(--color-ink)]">{b.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{b.body}</p>
              </div>
            );
          })}
        </div>

        {/* How it works */}
        <div className="mt-16 rounded-3xl bg-slate-50 px-8 py-10">
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">How the chef marketplace works</h2>
          <ol className="mt-6 space-y-4">
            {[
              "Create your chef profile and set your cuisine specialties, availability, and service area.",
              "Platform admins review and approve public chef profiles before households browse them.",
              "Households submit manual booking requests with date, guest count, and notes.",
              "You review requests, confirm or decline, and agree on details.",
              "After the cooking session, the household leaves a review — building your reputation.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-4 text-sm text-[var(--color-muted)]">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
