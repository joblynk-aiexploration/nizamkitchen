import Link from "next/link";
import { KeyRound, ShieldCheck, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { DATE_FORMAT_OPTIONS, DEFAULT_TIME_FORMAT, TIME_FORMAT_OPTIONS, normalizeDateFormat } from "@/lib/date-time-formats";
import { RELIGION_OPTIONS } from "@/lib/religion";
import { DEFAULT_APP_TIME_ZONE } from "@/lib/timezones";
import { prisma } from "@/lib/prisma";
import { getPrimaryLocation } from "@/server/maps/location-service";
import {
  getUserLocalizationPreferences,
  listEnabledCountryPhoneOptions,
  listEnabledLanguageOptions,
} from "@/server/localization/localization-service";
import {
  updateAdminAccountPreferencesAction,
  updateAdminAccountProfileAction,
  updateAdminPasswordAction,
} from "./actions";

export const dynamic = "force-dynamic";

const ADMIN_ACCOUNT_ROLES = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
  "auditor",
] as const;

export default async function AdminAccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [session, params] = await Promise.all([
    requirePlatformRole([...ADMIN_ACCOUNT_ROLES]),
    searchParams,
  ]);
  const [primaryLocation, languageOptions, phoneOptions, localization, recentSessions] = await Promise.all([
    getPrimaryLocation("user", session.user.id),
    listEnabledLanguageOptions(),
    listEnabledCountryPhoneOptions(),
    getUserLocalizationPreferences(session),
    prisma.session.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, ipAddress: true, userAgent: true, updatedAt: true, expiresAt: true },
    }),
  ]);
  const preferredLanguage = session.user.preferredLanguage ?? "";
  const selectedLanguage = languageOptions.find((option) => {
    const localeLanguageCode = option.localeCode.split("-")[0];
    return option.value === preferredLanguage
      || option.label === preferredLanguage
      || localeLanguageCode === preferredLanguage
      || option.value === preferredLanguage.replace(/\s*\([^)]*\)\s*$/, "").trim();
  })?.value ?? "";
  const defaultCountryCode = primaryLocation?.countryCode ?? session.activeOrganization?.countryCode ?? "US";
  const defaultCurrencyCode = localization.preference?.currencyCode
    ?? session.activeOrganization?.currencyCode
    ?? "USD";
  const defaultLocale = localization.preference?.localeCode
    ?? session.user.preferredLocale
    ?? session.activeOrganization?.defaultLocale
    ?? "en-US";
  const defaultTimezone = localization.preference?.timezone
    ?? session.user.preferredTimezone
    ?? session.activeOrganization?.defaultTimezone
    ?? DEFAULT_APP_TIME_ZONE;
  const selectedDateFormat = normalizeDateFormat(localization.preference?.dateFormat);
  const selectedTimeFormat = localization.preference?.timeFormat === DEFAULT_TIME_FORMAT
    ? localization.preference.timeFormat
    : DEFAULT_TIME_FORMAT;
  const roleLabel = session.user.platformRole?.replaceAll("_", " ") ?? "admin";
  const initials = session.user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NK";
  const lastSession = recentSessions[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin settings"
        title="My account settings"
        description="Manage your own admin profile, contact information, address, language, timezone, currency, and session context. Platform-wide configuration stays under System Settings."
      />

      <FormMessage message={params.message} />

      <section className="overflow-hidden rounded-[2rem] border border-[#cfe0dd] bg-[linear-gradient(135deg,#08283b_0%,#0d4b43_55%,#136f5d_100%)] p-6 text-white shadow-[0_28px_70px_rgba(15,48,71,0.22)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] border border-white/25 bg-white/15 text-3xl font-semibold shadow-inner">
              {initials}
            </div>
            <div>
              <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                Personal admin account
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{session.user.fullName}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-100">
                Manage the identity used to operate NizamKitchen, including email, password, contact details, profile visibility,
                timezone, language, and regional defaults.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white px-3 py-1 text-slate-900">{roleLabel}</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-950">{session.user.status}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/20 bg-white/12 p-5 shadow-2xl backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Account controls</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3 rounded-2xl bg-white/12 px-4 py-3">
                <UserCog className="mt-0.5 h-4 w-4 text-emerald-100" />
                <div>
                  <p className="font-semibold text-white">Profile and email</p>
                  <p className="text-slate-200">Update your public admin identity and contact information.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white/12 px-4 py-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-emerald-100" />
                <div>
                  <p className="font-semibold text-white">Password management</p>
                  <p className="text-slate-200">Change your password and sign out other sessions.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white/12 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-100" />
                <div>
                  <p className="font-semibold text-white">Last account activity</p>
                  <p className="text-slate-200">
                    {lastSession
                      ? lastSession.updatedAt.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })
                      : "No recent session activity recorded."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">Personal account</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Profile and contact details</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                These settings update your own admin identity. They do not change platform-wide roles or permissions.
              </p>
            </div>
            <Link href={`/admin/users/${session.user.id}`} className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50">
              View admin record
            </Link>
          </div>

          <form action={updateAdminAccountProfileAction} className="space-y-5">
            <input type="hidden" name="profilePhotoFileId" value={session.user.profilePhotoFileId ?? ""} />
            <input type="hidden" name="coverPhotoFileId" value={session.user.coverPhotoFileId ?? ""} />
            <input type="hidden" name="latitude" value={primaryLocation?.latitude?.toString() ?? ""} />
            <input type="hidden" name="longitude" value={primaryLocation?.longitude?.toString() ?? ""} />
            <input type="hidden" name="providerPlaceId" value={primaryLocation?.providerPlaceId ?? ""} />

            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Full name" name="fullName" defaultValue={session.user.fullName} required />
              <TextInput label="Email" name="email" type="email" defaultValue={session.user.email} required />
              <TextInput label="Headline" name="headline" defaultValue={session.user.headline ?? ""} />
              <TextInput label="Public location" name="locationText" defaultValue={session.user.locationText ?? session.user.location ?? ""} hint="Example: Dallas, TX. This is safe to show on your profile." />
              <PhoneNumberInput
                defaultValue={session.user.phone}
                defaultCountryCode={phoneOptions.find((option) => option.countryCode === defaultCountryCode)?.phoneCountryCode}
                options={phoneOptions}
              />
              <SelectInput
                label="Religion"
                name="religion"
                defaultValue={session.user.religion ?? ""}
                hint="Optional and private unless an authorized admin reviews your profile."
                options={[{ value: "", label: "Select religion" }, ...RELIGION_OPTIONS]}
              />
              <SelectInput
                label="Preferred language"
                name="preferredLanguage"
                defaultValue={selectedLanguage}
                options={[
                  { value: "", label: "Select a language" },
                  ...languageOptions.map((option) => ({ value: option.value, label: option.label })),
                ]}
              />
              <SelectInput
                label="Address visibility"
                name="locationVisibility"
                defaultValue={primaryLocation?.visibility ?? "private"}
                options={[
                  { value: "private", label: "Private - only you and authorized admins" },
                  { value: "organization", label: "Organization members" },
                  { value: "public_city_only", label: "Public city only" },
                  { value: "public_full", label: "Public full address" },
                ]}
              />
            </div>

            <TextArea label="Bio" name="bio" defaultValue={session.user.bio ?? ""} />

            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Address line 1" name="addressLine1" defaultValue={primaryLocation?.addressLine1 ?? ""} />
              <TextInput label="Address line 2" name="addressLine2" defaultValue={primaryLocation?.addressLine2 ?? ""} />
              <TextInput label="City" name="city" defaultValue={primaryLocation?.city ?? ""} />
              <TextInput label="State / region" name="region" defaultValue={primaryLocation?.region ?? ""} />
              <TextInput label="Country code" name="countryCode" defaultValue={defaultCountryCode} maxLength={2} />
              <TextInput label="Postal code" name="postalCode" defaultValue={primaryLocation?.postalCode ?? ""} />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-sm">
              <input type="checkbox" name="publicProfileEnabled" defaultChecked={session.user.publicProfileEnabled} className="mt-1" />
              <span>
                <span className="block font-semibold text-[var(--color-ink)]">Enable public/internal profile view</span>
                <span className="mt-1 block text-[var(--color-muted)]">Private contact and address details stay protected unless you explicitly choose public visibility.</span>
              </span>
            </label>

            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--button-primary-text)] shadow-sm hover:bg-[var(--button-primary-hover-bg)]">
              Save account settings
            </button>
          </form>
        </Card>

        <div className="space-y-5">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">Access</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Admin role summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-[var(--text-secondary)]">Role</span>
                <span className="font-semibold text-[var(--text-primary)]">{session.user.platformRole?.replaceAll("_", " ")}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-[var(--text-secondary)]">Status</span>
                <span className="font-semibold text-[var(--text-primary)]">{session.user.status}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="font-medium text-[var(--text-secondary)]">Countries</span>
                <span className="font-semibold text-[var(--text-primary)]">{session.countryAssignments.length || "Global / none"}</span>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">Security</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Password and sessions</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Change your password directly from this secure form. Other active sessions will be signed out automatically.
            </p>
            <form action={updateAdminPasswordAction} className="mt-4 space-y-3">
              <TextInput
                label="Current password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <TextInput
                label="New password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                hint="Use at least 8 characters with uppercase, lowercase, and a number."
                required
              />
              <TextInput
                label="Confirm new password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
              <button className="w-full rounded-2xl bg-[var(--button-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--button-primary-text)] shadow-sm hover:bg-[var(--button-primary-hover-bg)]">
                Change password
              </button>
            </form>
            <Link href="/forgot-password" className="mt-3 inline-flex text-sm font-semibold text-[var(--color-primary-strong)] hover:underline">
              Send a reset link instead
            </Link>
            <div className="mt-5 space-y-3">
              {recentSessions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
                  <p className="font-semibold text-[var(--text-primary)]">Updated {item.updatedAt.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</p>
                  <p className="mt-1 break-words">{item.ipAddress ?? "No IP recorded"}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-strong)]">Preferences</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Language, timezone, and regional defaults</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            These preferences affect how your admin account sees dates, times, currencies, and measurements.
          </p>
        </div>

        <form action={updateAdminAccountPreferencesAction} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Language / locale
            <select name="localeCode" defaultValue={defaultLocale} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              {localization.locales.length ? localization.locales.map((locale) => (
                <option key={locale.localeCode} value={locale.localeCode}>
                  {locale.languageName} ({locale.localeCode})
                </option>
              )) : <option value="en-US">English (United States)</option>}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Timezone
            <select name="timezone" defaultValue={defaultTimezone} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm" required>
              {localization.timeZones.length ? localization.timeZones.map((timeZone) => (
                <option key={timeZone.value} value={timeZone.value}>
                  {timeZone.label}
                </option>
              )) : <option value={DEFAULT_APP_TIME_ZONE}>{DEFAULT_APP_TIME_ZONE}</option>}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Measurement system
            <select name="measurementSystem" defaultValue={localization.preference?.measurementSystem ?? session.activeOrganization?.measurementSystem ?? "imperial"} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <option value="">Use default</option>
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
            Currency
            <select name="currencyCode" defaultValue={defaultCurrencyCode} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <option value="">Use default</option>
              {localization.currencies.length ? localization.currencies.map((currency) => (
                <option key={currency.currencyCode} value={currency.currencyCode}>
                  {currency.currencyCode} - {currency.displayName}
                </option>
              )) : <option value="USD">USD - US Dollar</option>}
            </select>
          </label>

          <SelectInput label="Date format" name="dateFormat" defaultValue={selectedDateFormat} options={[...DATE_FORMAT_OPTIONS]} hint="Default is MM/DD/YYYY." />
          <SelectInput label="Time format" name="timeFormat" defaultValue={selectedTimeFormat} options={[...TIME_FORMAT_OPTIONS]} hint="Default is 12-hour time." />

          <button className="rounded-2xl bg-[var(--button-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--button-primary-text)] shadow-sm hover:bg-[var(--button-primary-hover-bg)] md:col-span-2">
            Save regional preferences
          </button>
        </form>
      </Card>
    </div>
  );
}
