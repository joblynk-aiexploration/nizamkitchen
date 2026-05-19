import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export default async function BackgroundChecksPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const countryCodes = session.user.platformRole === "country_manager" ? session.countryAssignments.map((assignment) => assignment.countryCode) : undefined;
  const where: Prisma.SellerBackgroundCheckWhereInput = countryCodes ? { organization: { countryCode: { in: countryCodes } } } : {};
  const checks = await prisma.sellerBackgroundCheck.findMany({ where, include: { organization: { select: { name: true, countryCode: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <AdminShell session={session} title="Background checks" description="Placeholder/provider status tracking. No raw SSNs are stored in NizamKitchen.">
      <AdminDataTable
        data={checks}
        emptyMessage="No background checks recorded."
        columns={[
          { key: "seller", header: "Seller", render: (item) => item.organization.name },
          { key: "provider", header: "Provider", render: (item) => item.provider.replace(/_/g, " ") },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "clear" ? "success" : item.status === "failed" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
          { key: "adverse", header: "Adverse action", render: (item) => item.adverseActionStatus.replace(/_/g, " ") },
        ]}
      />
    </AdminShell>
  );
}
