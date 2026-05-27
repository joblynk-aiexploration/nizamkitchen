import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaginationInput, getPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function KycBackgroundChecksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const paginationInput = getPaginationInput({ page: params.page });
  const countryCodes = session.user.platformRole === "country_manager" ? session.countryAssignments.map((assignment) => assignment.countryCode) : undefined;
  const where = countryCodes ? { organization: { countryCode: { in: countryCodes } } } : {};
  const [totalChecks, checks] = await Promise.all([
    prisma.sellerBackgroundCheck.count({ where }),
    prisma.sellerBackgroundCheck.findMany({
      where,
      include: { organization: { select: { name: true, countryCode: true } } },
      orderBy: { updatedAt: "desc" },
      skip: paginationInput.skip,
      take: paginationInput.take,
    }),
  ]);
  return (
    <AdminShell session={session} title="KYC background checks" description="Safe status-only background check view. Full reports are not stored or shown.">
      <AdminDataTable
        data={checks}
        emptyMessage="No background checks recorded."
        pagination={getPaginationMeta(totalChecks, paginationInput)}
        paginationBasePath="/admin/kyc/background-checks"
        paginationSearchParams={params}
        paginationItemLabel="background checks"
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
