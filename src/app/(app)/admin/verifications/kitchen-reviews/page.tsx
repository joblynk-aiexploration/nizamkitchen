import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export default async function KitchenReviewsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const countryCodes = session.user.platformRole === "country_manager" ? session.countryAssignments.map((assignment) => assignment.countryCode) : undefined;
  const where: Prisma.KitchenSafetyReviewWhereInput = countryCodes ? { organization: { countryCode: { in: countryCodes } } } : {};
  const reviews = await prisma.kitchenSafetyReview.findMany({ where, include: { organization: { select: { name: true, countryCode: true } }, photos: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <AdminShell session={session} title="Kitchen safety reviews" description="Review private kitchen photos and admin safety scores. Photos are never public by default.">
      <AdminDataTable
        data={reviews}
        emptyMessage="No kitchen safety reviews recorded."
        columns={[
          { key: "seller", header: "Seller", render: (item) => item.organization.name },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
          { key: "photos", header: "Photos", render: (item) => item.photos.length },
          { key: "scores", header: "Scores", render: (item) => [item.cleanlinessScore, item.storageScore, item.sanitationScore, item.packagingScore].filter(Boolean).join(" / ") || "Not scored" },
        ]}
      />
    </AdminShell>
  );
}
