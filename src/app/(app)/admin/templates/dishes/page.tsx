import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listDishTemplates } from "@/server/templates";

export const dynamic = "force-dynamic";

export default async function AdminDishTemplatesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const templates = await listDishTemplates(session);

  return (
    <AdminShell
      session={session}
      title="Dish templates"
      description="Platform-owned dish definitions with city, state, country, cuisine, category, pricing, ingredients, and steps."
      actions={<Button asChild><Link href="/admin/templates/dishes/new">New dish template</Link></Button>}
    >
      <AdminDataTable
        data={templates}
        emptyMessage="No dish templates yet."
        columns={[
          {
            key: "name",
            header: "Dish",
            render: (template) => (
              <Link href={`/admin/templates/dishes/${template.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                {template.name}
              </Link>
            ),
          },
          { key: "category", header: "Category", render: (template) => template.category },
          { key: "location", header: "Location", render: (template) => [template.city, template.region, template.countryCode].filter(Boolean).join(", ") || "Global" },
          { key: "status", header: "Status", render: (template) => <Badge tone={template.status === "active" ? "success" : "neutral"}>{template.status}</Badge> },
          { key: "visibility", header: "Visibility", render: (template) => <Badge tone="info">{template.visibility}</Badge> },
          { key: "parts", header: "Parts", render: (template) => `${template._count.ingredients} ingredients / ${template._count.steps} steps` },
        ]}
      />
    </AdminShell>
  );
}
