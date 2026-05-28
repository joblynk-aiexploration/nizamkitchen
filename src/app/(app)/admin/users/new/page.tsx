import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { TextInput } from "@/components/ui/text-input";
import { createAdminUserAction } from "../actions";

export const dynamic = "force-dynamic";

const platformRoles = ["platform_admin", "country_manager", "support_admin", "auditor"] as const;
const ownerOnlyRoles = ["platform_owner"] as const;
const organizationRoles = [
  "org_owner",
  "org_admin",
  "member",
  "household_member",
  "chef_owner",
  "chef_staff",
  "home_catering_owner",
  "home_catering_staff",
  "restaurant_owner",
  "restaurant_staff",
  "grocery_partner_admin",
] as const;

export default async function NewAdminUserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, params] = await Promise.all([
    requirePlatformRole(["platform_owner", "platform_admin"]),
    searchParams,
  ]);
  const [countries, organizations] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      select: { countryCode: true, countryName: true },
      orderBy: { countryName: "asc" },
    }),
    prisma.organization.findMany({
      select: { id: true, name: true, organizationType: true },
      orderBy: { name: "asc" },
      take: 250,
    }),
  ]);
  const allowedPlatformRoles = session.user.platformRole === "platform_owner"
    ? [...ownerOnlyRoles, ...platformRoles]
    : platformRoles;

  return (
    <AdminShell
      session={session}
      title="Create user"
      description="Platform owners and platform admins can create users, assign platform roles, attach an organization membership, and scope country access."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/users">Back to users</Link>
        </Button>
      }
    >
      <FormMessage message={params.message} />
      <Card>
        <form action={createAdminUserAction} className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <TextInput label="Full name" name="fullName" required />
            <TextInput label="Email" name="email" type="email" required />
            <TextInput
              label="Temporary password"
              name="password"
              type="password"
              required
              minLength={8}
              hint="Use at least 8 characters with uppercase, lowercase, and a number."
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
              <span>Status</span>
              <select name="status" defaultValue="active" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
              <span>Platform role</span>
              <select name="platformRole" defaultValue="" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="">No platform role</option>
                {allowedPlatformRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              {session.user.platformRole !== "platform_owner" ? (
                <span className="text-xs font-normal text-[var(--color-muted)]">Only the platform owner can create another platform owner.</span>
              ) : null}
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
              <span>Organization membership</span>
              <select name="organizationId" defaultValue="" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="">No organization membership</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} ({organization.organizationType})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
              <span>Organization role</span>
              <select name="organizationRole" defaultValue="member" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                {organizationRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="font-semibold text-[var(--color-ink)]">Country access</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Select countries for country managers or scoped support workflows. Leave blank for users without country assignments.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {countries.map((country) => (
                <label key={country.countryCode} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-sm">
                  <input type="checkbox" name="countryCodes" value={country.countryCode} />
                  <span>{country.countryName} ({country.countryCode})</span>
                </label>
              ))}
            </div>
          </section>

          <Button type="submit">Create user</Button>
        </form>
      </Card>
    </AdminShell>
  );
}
