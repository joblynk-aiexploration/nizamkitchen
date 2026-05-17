import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { listIngredients } from "@/server/ingredients";

export const dynamic = "force-dynamic";

export default async function AdminIngredientsPage({
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

  const ingredients = await listIngredients({
    search: params.search,
    category: params.category as never,
    isGlobal: params.scope === "org" ? false : params.scope === "global" ? true : undefined,
  });

  const categories = [
    "vegetable", "fruit", "meat", "poultry", "seafood", "dairy",
    "grain", "lentil", "spice", "herb", "oil", "condiment",
    "nut", "sweetener", "beverage", "packaged", "other",
  ];

  return (
    <AdminShell
      session={session}
      title="Ingredient library"
      description="Global ingredients with aliases and unit conversion data. These power the recipe and grocery engine."
    >
      <AdminFilterBar searchPlaceholder="Search by name or alias">
        <select
          name="category"
          defaultValue={params.category ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <select
          name="scope"
          defaultValue={params.scope ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All scopes</option>
          <option value="global">Global only</option>
          <option value="org">Org-specific only</option>
        </select>
      </AdminFilterBar>

      <AdminDataTable
        data={ingredients}
        emptyMessage="No ingredients matched the current filters."
        columns={[
          {
            key: "name",
            header: "Ingredient",
            render: (i) => (
              <div>
                <Link
                  href={`/admin/ingredients/${i.id}`}
                  className="font-semibold text-[var(--color-primary)]"
                >
                  {i.canonicalName}
                </Link>
                {i.slug !== i.canonicalName.toLowerCase().replace(/\s+/g, "-") && (
                  <p className="text-xs text-[var(--color-muted)]">slug: {i.slug}</p>
                )}
              </div>
            ),
          },
          {
            key: "category",
            header: "Category",
            render: (i) => <Badge tone="neutral">{i.category}</Badge>,
          },
          {
            key: "aliases",
            header: "Aliases",
            render: (i) => (
              <div className="flex flex-wrap gap-1">
                {i.aliases.slice(0, 3).map((a) => (
                  <span key={a.id} className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs">{a.alias}</span>
                ))}
                {i.aliases.length > 3 && (
                  <span className="text-xs text-[var(--color-muted)]">+{i.aliases.length - 3}</span>
                )}
              </div>
            ),
          },
          {
            key: "conversion",
            header: "Conversion data",
            render: (i) => (
              <div className="text-sm text-[var(--color-muted)]">
                {i.averagePieceWeightGrams && <p>~{i.averagePieceWeightGrams}g/pc</p>}
                {i.densityGramPerMl && <p>{i.densityGramPerMl} g/ml</p>}
                {!i.averagePieceWeightGrams && !i.densityGramPerMl && <p>—</p>}
              </div>
            ),
          },
          {
            key: "scope",
            header: "Scope",
            render: (i) => (
              <Badge tone={i.isGlobal ? "info" : "neutral"}>
                {i.isGlobal ? "global" : "org"}
              </Badge>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
