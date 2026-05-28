import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  CalendarDays,
  ChefHat,
  CircleDollarSign,
  Globe2,
  Heart,
  LifeBuoy,
  LockKeyhole,
  Shield,
  Store,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

type SettingsTile = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  icon: LucideIcon;
  tone?: "primary" | "soft" | "neutral";
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function organizationTypeLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SettingsActionCard({ tile }: { tile: SettingsTile }) {
  const Icon = tile.icon;
  const isPrimary = tile.tone === "primary";

  return (
    <Link
      href={tile.href}
      className={[
        "group flex h-full flex-col justify-between rounded-3xl border p-5 shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        isPrimary
          ? "border-[var(--color-primary)]/25 bg-[#ecf8f5]"
          : "border-[var(--color-border)] bg-white",
      ].join(" ")}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <span
            className={[
              "inline-flex h-12 w-12 items-center justify-center rounded-2xl",
              isPrimary ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-[var(--color-primary-strong)]",
            ].join(" ")}
          >
            <Icon className="h-5 w-5" />
          </span>
          <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-[var(--color-primary)]" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">{tile.eyebrow}</p>
        <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{tile.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{tile.description}</p>
      </div>
      <span className="mt-5 inline-flex text-sm font-semibold text-[var(--color-primary-strong)]">{tile.action}</span>
    </Link>
  );
}

export default async function SettingsPage() {
  const session = await requireMembership();
  const orgType = session.activeOrganization.organizationType;
  const workspaceProfile =
    orgType === "chef_business"
      ? {
          eyebrow: "Chef business",
          title: "Chef profile, services, photos, and social links",
          description: "Update the chef name households see, profile and cover photos, specialties, contact details, documents, and public links.",
          href: "/chef/profile",
          action: "Edit chef profile",
          icon: ChefHat,
        }
      : orgType === "home_catering"
        ? {
            eyebrow: "Catering business",
            title: "Caterer profile, menus, photos, and pickup details",
            description: "Update your catering business name, home or restaurant caterer details, menu readiness, pickup/delivery settings, and public links.",
            href: "/catering/profile",
            action: "Edit catering profile",
            icon: Store,
          }
        : orgType === "restaurant"
          ? {
              eyebrow: "Restaurant business",
              title: "Restaurant name, photos, location, and social links",
              description: "Update the restaurant name households see, logo, cover photo, address, opening details, and public profile links.",
              href: "/restaurant/profile",
              action: "Edit restaurant profile",
              icon: Building2,
            }
          : orgType === "household"
            ? {
                eyebrow: "Household",
                title: "Household name, family members, and planning defaults",
                description: "Update household details that affect family members, servings, meal plans, grocery lists, spice level, and family defaults.",
                href: "/household/preferences",
                action: "Edit household settings",
                icon: Heart,
              }
            : null;

  const commonTiles: SettingsTile[] = [
    {
      eyebrow: "Profile",
      title: "Personal profile and photos",
      description: "Update your name, email, phone number, address, profile photo, cover photo, bio, and public profile visibility.",
      href: "/settings/profile",
      action: "Open profile settings",
      icon: UserRound,
      tone: "primary",
    },
    {
      eyebrow: "Preferences",
      title: "Language, currency, timezone, and units",
      description: "Choose your locale, timezone, currency, measurement system, date format, and 12-hour time preference.",
      href: "/settings/preferences",
      action: "Open preferences",
      icon: Globe2,
    },
    {
      eyebrow: "Notifications",
      title: "Email and in-app notification controls",
      description: "Control updates for orders, home chef requests, grocery lists, meal planning, account activity, and support.",
      href: "/settings/notifications",
      action: "Open notifications",
      icon: Bell,
    },
    {
      eyebrow: "Privacy",
      title: "Privacy center and data controls",
      description: "Review your account data, privacy settings, activity, export requests, and deletion or anonymization requests.",
      href: "/privacy-center",
      action: "Open privacy center",
      icon: Shield,
    },
    {
      eyebrow: "Support",
      title: "Tickets and help requests",
      description: "Create a support ticket, view previous tickets, and keep conversations with the NizamKitchen team in one place.",
      href: "/support/tickets",
      action: "Open tickets",
      icon: LifeBuoy,
    },
  ];

  const workspaceTiles: SettingsTile[] = workspaceProfile
    ? [
        {
          ...workspaceProfile,
          tone: "primary",
        },
      ]
    : [];

  if (orgType === "household") {
    workspaceTiles.push(
      {
        eyebrow: "Meal planner",
        title: "Household meal preferences",
        description: "Save family size, spice level, restrictions, diet preferences, and cooking rhythm for weekly planning.",
        href: "/settings/meal-preferences",
        action: "Open meal preferences",
        icon: CalendarDays,
      },
      {
        eyebrow: "Family access",
        title: "Household members",
        description: "Add family members, manage household access, and share recipes or meal plans with people in your home.",
        href: "/household/members",
        action: "Manage members",
        icon: UsersRound,
      },
      {
        eyebrow: "Billing",
        title: "Plans, invoices, and receipts",
        description: "Review your household billing plan, invoices, receipts, and subscription options.",
        href: "/billing",
        action: "Open billing",
        icon: CircleDollarSign,
      },
    );
  } else {
    workspaceTiles.push(
      {
        eyebrow: "Payments",
        title: "Payouts, invoices, and settlements",
        description: "Review seller payment setup, payout status, invoices, and settlement documents for your workspace.",
        href: "/settings/payments",
        action: "Open payment settings",
        icon: CircleDollarSign,
      },
      {
        eyebrow: "Verification",
        title: "Business verification status",
        description: "Review the profile and documentation area connected to your seller verification workflow.",
        href: orgType === "restaurant" ? "/restaurant/verification" : orgType === "home_catering" ? "/catering/verification" : "/chef/verification",
        action: "Open verification",
        icon: BadgeCheck,
      },
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Account control center"
        description="A clean home for your personal account, workspace profile, regional preferences, notifications, privacy, support, and billing settings."
      />

      <section className="overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(135deg,#092f3a_0%,#0f766e_52%,#163447_100%)] text-white shadow-2xl">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Signed in workspace</p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/15 text-2xl font-bold shadow-inner">
                  {initials(session.user.fullName)}
                </div>
                <div>
                  <h2 className="font-serif text-4xl leading-tight">{session.user.fullName}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">{session.user.email}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Workspace</p>
                <p className="mt-2 font-semibold">{session.activeOrganization.name}</p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Type</p>
                <p className="mt-2 font-semibold">{organizationTypeLabel(orgType)}</p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Timezone</p>
                <p className="mt-2 font-semibold">{session.activeOrganization.defaultTimezone}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/20 bg-white/95 p-5 text-[var(--text-primary)] shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">Workspace summary</p>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Status</span>
                <StatusBadge value={session.activeOrganization.status} />
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Country</span>
                <CountryBadge
                  countryCode={session.activeOrganization.countryCode}
                  countryName={session.activeOrganization.country.countryName}
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Locale</span>
                <span className="text-sm font-semibold">{session.activeOrganization.defaultLocale}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Slug</span>
                <span className="max-w-[11rem] truncate text-right text-sm font-semibold">{session.activeOrganization.slug}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary-strong)]">Account</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Personal settings</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {commonTiles.map((tile) => (
                <SettingsActionCard key={tile.href} tile={tile} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary-strong)]">Workspace</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Business and household settings</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {workspaceTiles.map((tile) => (
                <SettingsActionCard key={tile.href} tile={tile} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <Card className="bg-[#f7fbfb]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">Recommended</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Keep your account launch-ready</h2>
            <div className="mt-5 space-y-3">
              <Link href="/settings/profile" className="flex items-center gap-3 rounded-2xl bg-white p-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:text-[var(--color-primary-strong)]">
                <UserRound className="h-4 w-4 text-[var(--color-primary)]" />
                Complete profile details
              </Link>
              <Link href="/settings/preferences" className="flex items-center gap-3 rounded-2xl bg-white p-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:text-[var(--color-primary-strong)]">
                <Globe2 className="h-4 w-4 text-[var(--color-primary)]" />
                Confirm timezone and currency
              </Link>
              <Link href="/settings/notifications" className="flex items-center gap-3 rounded-2xl bg-white p-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:text-[var(--color-primary-strong)]">
                <Bell className="h-4 w-4 text-[var(--color-primary)]" />
                Review notification delivery
              </Link>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">Security</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Password and account access</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Use secure password reset when needed. Business, household, and billing permissions remain controlled by your workspace role.
            </p>
            <Link href="/forgot-password" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50">
              <LockKeyhole className="h-4 w-4" />
              Reset password
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
