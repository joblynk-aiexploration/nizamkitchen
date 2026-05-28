import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMenuTemplates } from "@/server/templates";

export const dynamic = "force-dynamic";

export default async function AdminMenuTemplatesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const templates = await listMenuTemplates(session);

  return (
    <AdminShell
      session={session}
      title="Menu templates"
      description="Daily, weekly, monthly, Ramadan, Eid, wedding, party, household, and seller menu templates."
      actions={<Button asChild><Link href="/admin/templates/menus/new">New menu template</Link></Button>}
    >
      <AdminDataTable
        data={templates}
        emptyMessage="No menu templates yet."
        columns={[
          {
            key: "name",
            header: "Template",
            render: (template) => (
              <Link href={`/admin/templates/menus/${template.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                {template.name}
              </Link>
            ),
          },
          { key: "type", header: "Type", render: (template) => template.templateType },
          { key: "location", header: "Location", render: (template) => [template.city, template.region, template.countryCode].filter(Boolean).join(", ") || "Global" },
          { key: "seller", header: "Seller", render: (template) => template.sellerType ?? "Any" },
          { key: "status", header: "Status", render: (template) => <Badge tone={template.status === "active" ? "success" : "neutral"}>{template.status}</Badge> },
          { key: "items", header: "Items", render: (template) => template._count.items },
        ]}
      />
    </AdminShell>
  );
}
