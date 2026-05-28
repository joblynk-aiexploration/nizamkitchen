import { Plus } from "lucide-react";
import { requireMembership } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { PageHeader } from "@/components/ui/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { SelectInput } from "@/components/ui/select-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextInput } from "@/components/ui/text-input";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const session = await requireMembership();

  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { countryName: "asc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tenant management"
        title="Organizations"
        description="Switch the active tenant, inspect organization metadata, and create additional workspaces without breaking isolation."
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-xl font-semibold">Your memberships</h2>
          <div className="mt-5 space-y-4">
            {session.memberships.map((membership) => (
              <form
                key={membership.id}
                action="/api/organizations/switch"
                method="post"
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-alt)] p-4"
              >
                <input type="hidden" name="organizationId" value={membership.organizationId} />
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{membership.organization.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge value={membership.organization.status} />
                      <RoleBadge value={membership.role} />
                      <CountryBadge
                        countryCode={membership.organization.countryCode}
                        countryName={membership.organization.country.countryName}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant={
                      session.activeOrganization?.id === membership.organizationId
                        ? "secondary"
                        : "primary"
                    }
                  >
                    {session.activeOrganization?.id === membership.organizationId
                      ? "Current organization"
                      : "Switch organization"}
                  </Button>
                </div>
              </form>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Create organization</h2>
              <p className="text-sm text-[var(--color-muted)]">
                Provision another tenant under your user account.
              </p>
            </div>
          </div>
          <form action="/api/organizations/create" method="post" className="mt-6 grid gap-4">
            <TextInput label="Organization name" name="name" required />
            <SelectInput
              label="Organization type"
              name="organizationType"
              options={[
                { value: "household", label: "Household" },
                { value: "chef_business", label: "Chef business" },
                { value: "home_catering", label: "Home catering" },
                { value: "restaurant", label: "Restaurant" },
                { value: "grocery_partner", label: "Grocery partner" },
                { value: "internal_admin", label: "Internal admin" },
              ]}
            />
            <SelectInput
              label="Country"
              name="countryCode"
              options={countries.map((country) => ({
                value: country.countryCode,
                label: `${country.countryName} (${country.countryCode})`,
              }))}
            />
            <Button type="submit">Create organization</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
