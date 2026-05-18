import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminChefProfiles } from "@/server/chefs";

export const dynamic = "force-dynamic";

export default async function AdminChefVerificationsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const profiles = await listAdminChefProfiles(session, { verificationStatus: "pending" });

  return (
    <AdminShell
      session={session}
      title="Chef verifications"
      description="Review chef profiles submitted for verification. Verification remains admin-controlled."
    >
      <AdminDataTable
        data={profiles}
        emptyMessage="No pending chef verifications."
        columns={[
          {
            key: "profile",
            header: "Chef",
            render: (profile) => (
              <div>
                <Link href={`/admin/chefs/${profile.id}`} className="font-semibold text-[var(--color-primary)]">{profile.displayName}</Link>
                <p className="text-[var(--color-muted)]">{profile.organization.name} · {profile.countryCode}</p>
              </div>
            ),
          },
          { key: "status", header: "Status", render: (profile) => <Badge tone="warning">{profile.status}</Badge> },
          { key: "verification", header: "Verification", render: (profile) => <Badge tone="warning">{profile.verificationStatus}</Badge> },
          { key: "updated", header: "Updated", render: (profile) => profile.updatedAt.toLocaleDateString() },
        ]}
      />
    </AdminShell>
  );
}
