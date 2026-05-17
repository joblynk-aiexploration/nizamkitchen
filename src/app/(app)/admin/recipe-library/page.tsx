import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { formatTotalTime } from "@/lib/recipe-utils";
import { listAdminRecipes } from "@/server/recipes";
import { listCuisines } from "@/server/cuisines";

export const dynamic = "force-dynamic";

export default async function AdminRecipeLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);
  const params = await searchParams;

  const [recipes, cuisines] = await Promise.all([
    listAdminRecipes({
      search: params.search,
      cuisineId: params.cuisineId,
      isPublished: params.published === "true" ? true : params.published === "false" ? false : undefined,
    }),
    listCuisines(),
  ]);

  const canMutate =
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Recipe library"
      description="Manage global platform recipes, publication status, and cuisine classification."
      actions={
        canMutate ? (
          <Button asChild>
            <Link href="/admin/recipe-library/new">Create recipe</Link>
          </Button>
        ) : null
      }
    >
      <AdminFilterBar searchPlaceholder="Search recipe name">
        <select
          name="cuisineId"
          defaultValue={params.cuisineId ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All cuisines</option>
          {cuisines.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          name="published"
          defaultValue={params.published ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
      </AdminFilterBar>

      <AdminDataTable
        data={recipes}
        emptyMessage="No recipes matched the current filters."
        columns={[
          {
            key: "name",
            header: "Recipe",
            render: (r) => (
              <div>
                <Link
                  href={`/admin/recipe-library/${r.id}`}
                  className="font-semibold text-[var(--color-primary)]"
                >
                  {r.name}
                </Link>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{r.cuisine.name}</p>
              </div>
            ),
          },
          {
            key: "meta",
            header: "Details",
            render: (r) => (
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  <Badge tone="neutral">{r.difficulty}</Badge>
                  <Badge tone="warning">{r.spiceLevel}</Badge>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  {formatTotalTime(r)} · {r.servings} servings
                </p>
              </div>
            ),
          },
          {
            key: "counts",
            header: "Content",
            render: (r) => (
              <div className="text-sm">
                <p>{r._count.ingredients} ingredients</p>
                <p className="text-[var(--color-muted)]">{r._count.steps} steps</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <Badge tone={r.isPublished ? "success" : "neutral"}>
                  {r.isPublished ? "Published" : "Draft"}
                </Badge>
                {r.isGlobal && <Badge tone="info">global</Badge>}
                {r.countryCode && <Badge tone="neutral">{r.countryCode}</Badge>}
              </div>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
