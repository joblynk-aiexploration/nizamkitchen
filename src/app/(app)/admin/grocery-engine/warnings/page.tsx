import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminGroceryWarnings } from "@/server/grocery";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  info: "info",
  warning: "warning",
  error: "danger",
};

export default async function AdminGroceryWarningsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const warnings = await listAdminGroceryWarnings(200);

  return (
    <AdminShell
      session={session}
      title="Grocery Conversion Warnings"
      description="Conversion warnings generated across all organizations when building grocery lists."
    >
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">
          Recent warnings ({warnings.length})
        </h2>

        {warnings.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            No conversion warnings found. This is a good sign — all merges were clean.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {warnings.map((w) => (
              <div
                key={w.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] p-3"
              >
                <Badge tone={SEVERITY_TONE[w.severity] ?? "neutral"}>{w.severity}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-ink)]">{w.message}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
                    <span>List: {w.groceryList.name}</span>
                    {w.ingredient && <span>Ingredient: {w.ingredient.canonicalName}</span>}
                    {w.sourceRecipeName && <span>Recipe: {w.sourceRecipeName}</span>}
                    <span>{w.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
