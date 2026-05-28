import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listAdminHomeCateringProfiles } from "@/server/home-catering";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
];

const verificationOptions = [
  { value: "", label: "All verification" },
  { value: "unverified", label: "Unverified" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

export default async function AdminHomeCateringPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string; verificationStatus?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const [profiles, countries] = await Promise.all([
    listAdminHomeCateringProfiles(session, params),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { countryName: "asc" } }),
  ]);

  return (
    <AdminShell session={session} title="Home catering" description="Review, verify, pause, suspend, and manage home catering seller profiles.">
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profiles</p><p className="mt-3 text-3xl font-semibold">{profiles.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active</p><p className="mt-3 text-3xl font-semibold">{profiles.filter((p) => p.status === "active").length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verified</p><p className="mt-3 text-3xl font-semibold">{profiles.filter((p) => p.verificationStatus === "verified").length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public</p><p className="mt-3 text-3xl font-semibold">{profiles.filter((p) => p.isPublic).length}</p></Card>
      </section>

      <Card>
        <form className="grid gap-4 md:grid-cols-4">
          <SelectInput
            label="Country"
            name="countryCode"
            defaultValue={params.countryCode ?? ""}
            options={[{ value: "", label: "All countries" }, ...countries.map((c) => ({ value: c.countryCode, label: `${c.countryName} (${c.countryCode})` }))]}
          />
          <SelectInput label="Status" name="status" defaultValue={params.status ?? ""} options={statusOptions} />
          <SelectInput label="Verification" name="verificationStatus" defaultValue={params.verificationStatus ?? ""} options={verificationOptions} />
          <div className="flex items-end"><Button type="submit" className="w-full">Filter</Button></div>
        </form>
      </Card>

      <AdminDataTable
        data={profiles}
        emptyMessage="No home catering profiles found."
        columns={[
          {
            key: "profile",
            header: "Profile",
            render: (profile) => (
              <div>
                <Link href={`/admin/home-catering/${profile.id}`} className="font-semibold text-[var(--color-primary)]">{profile.displayName}</Link>
                <p className="text-[var(--color-muted)]">{profile.organization.name} · {profile.countryCode}</p>
              </div>
            ),
          },
          { key: "status", header: "Status", render: (profile) => <Badge tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge> },
          { key: "verification", header: "Verification", render: (profile) => <Badge tone={profile.verificationStatus === "verified" ? "success" : "warning"}>{profile.verificationStatus}</Badge> },
          { key: "public", header: "Public", render: (profile) => profile.isPublic ? "Yes" : "No" },
          { key: "city", header: "City", render: (profile) => profile.city ?? "Not set" },
        ]}
      />
    </AdminShell>
  );
}
