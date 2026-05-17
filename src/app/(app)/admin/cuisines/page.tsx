import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { listCuisines } from "@/server/cuisines";

export const dynamic = "force-dynamic";

export default async function AdminCuisinesPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);

  const cuisines = await listCuisines();

  return (
    <AdminShell
      session={session}
      title="Cuisines"
      description="Cuisine classifications used to organize the recipe library."
    >
      <AdminDataTable
        data={cuisines}
        emptyMessage="No cuisines found."
        columns={[
          {
            key: "name",
            header: "Cuisine",
            render: (c) => (
              <div>
                <Link
                  href={`/admin/cuisines/${c.id}`}
                  className="font-semibold text-[var(--color-primary)]"
                >
                  {c.name}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">slug: {c.slug}</p>
              </div>
            ),
          },
          {
            key: "description",
            header: "Description",
            render: (c) => (
              <p className="text-sm text-[var(--color-muted)] line-clamp-2">
                {c.description ?? "—"}
              </p>
            ),
          },
          {
            key: "scope",
            header: "Scope",
            render: (c) => (
              <div className="flex flex-wrap gap-2">
                <Badge tone={c.isGlobal ? "info" : "neutral"}>
                  {c.isGlobal ? "global" : "regional"}
                </Badge>
                {c.countryCode && <Badge tone="neutral">{c.countryCode}</Badge>}
              </div>
            ),
          },
          {
            key: "recipes",
            header: "Recipes",
            render: (c) => (
              <span className="text-sm">{c._count.recipes} recipes</span>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
