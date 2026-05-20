import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function KycBackgroundChecksPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const countryCodes = session.user.platformRole === "country_manager" ? session.countryAssignments.map((assignment) => assignment.countryCode) : undefined;
  const checks = await prisma.sellerBackgroundCheck.findMany({
    where: countryCodes ? { organization: { countryCode: { in: countryCodes } } } : {},
    include: { organization: { select: { name: true, countryCode: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <AdminShell session={session} title="KYC background checks" description="Safe status-only background check view. Full reports are not stored or shown.">
      <AdminDataTable
        data={checks}
        emptyMessage="No background checks recorded."
        columns={[
          { key: "seller", header: "Seller", render: (item) => item.organization.name },
          { key: "provider", header: "Provider", render: (item) => item.provider.replace(/_/g, " ") },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "clear" ? "success" : item.status === "failed" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
          { key: "summary", header: "Safe summary", render: (item) => item.resultSummary ?? "No report contents stored" },
        ]}
      />
    </AdminShell>
  );
}
