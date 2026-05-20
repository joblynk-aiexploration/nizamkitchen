import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminMenusPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const menus = await prisma.menu.findMany({
    include: {
      organization: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminShell session={session} title="Menus" description="Moderate home catering and restaurant menus across the platform.">
      <AdminDataTable
        data={menus}
        emptyMessage="No menus found."
        columns={[
          {
            key: "name",
            header: "Menu",
            render: (menu) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{menu.name}</p>
                <Link href={`/admin/organizations/${menu.organizationId}`} className="text-xs text-[var(--color-primary)] hover:underline">
                  {menu.organization.name}
                </Link>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (menu) => <Badge tone={menu.status === "active" ? "success" : "neutral"}>{menu.status}</Badge>,
          },
          {
            key: "visibility",
            header: "Visibility",
            render: (menu) => <Badge tone={menu.visibility === "public" ? "info" : "neutral"}>{menu.visibility}</Badge>,
          },
          {
            key: "items",
            header: "Items",
            render: (menu) => <span className="text-sm">{menu._count.items}</span>,
          },
          {
            key: "country",
            header: "Country",
            render: (menu) => <span className="text-sm">{menu.countryCode}</span>,
          },
        ]}
      />
    </AdminShell>
  );
}
