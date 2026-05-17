import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { hasPlatformRole, PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listGroceryLists } from "@/server/grocery";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  active: "success",
  completed: "info",
  archived: "warning",
};

export default async function GroceryListsPage() {
  const session = await requireMembership();
  const orgId = session.activeOrganization.id;

  const isPlatformAdmin = hasPlatformRole(session.user.platformRole, PLATFORM_ADMIN_ROLES);
  const featureEnabled = await isFeatureEnabled("grocery_engine", orgId);

  if (!featureEnabled && !isPlatformAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Grocery Engine"
          title="Grocery Lists"
          description="Generate smart grocery lists from your recipes."
        />
        <Card>
          <div className="py-12 text-center">
            <p className="text-lg font-semibold text-[var(--color-ink)]">Coming soon</p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              The Grocery Engine is not yet enabled for your organization. Contact your admin to enable it.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const lists = await listGroceryLists(orgId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Grocery Engine"
        title="Grocery Lists"
        description="Generate smart, unit-safe grocery lists from your recipes."
      />

      <div className="flex justify-end">
        <Button asChild>
          <Link href="/grocery-lists/new">New grocery list</Link>
        </Button>
      </div>

      {lists.length === 0 ? (
        <EmptyState
          title="No grocery lists yet"
          description="Create your first grocery list by selecting recipes and target servings."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <Card key={list.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/grocery-lists/${list.id}`}
                    className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                  >
                    {list.name}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {list.recipes.length} recipe{list.recipes.length !== 1 ? "s" : ""}
                    {" · "}
                    {list._count.items} item{list._count.items !== 1 ? "s" : ""}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[list.status] ?? "neutral"}>{list.status}</Badge>
              </div>

              {list.recipes.length > 0 && (
                <p className="text-xs text-[var(--color-muted)] line-clamp-2">
                  {list.recipes.map((r) => r.recipeNameSnapshot).join(", ")}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--color-muted)]">
                  {list.createdAt.toLocaleDateString()}
                </p>
                {list._count.warnings > 0 && (
                  <Badge tone="warning">{list._count.warnings} warning{list._count.warnings !== 1 ? "s" : ""}</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
