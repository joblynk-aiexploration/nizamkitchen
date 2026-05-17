import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminGroceryEnginePage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);

  const [listCount, itemCount, warningCount, recentLists] = await Promise.all([
    prisma.groceryList.count(),
    prisma.groceryListItem.count(),
    prisma.groceryConversionWarning.count(),
    prisma.groceryList.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true, warnings: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Total grocery lists", value: listCount },
    { label: "Total grocery items", value: itemCount },
    { label: "Conversion warnings", value: warningCount },
  ];

  const STATUS_COLORS: Record<string, string> = {
    draft: "text-slate-600 bg-slate-100",
    active: "text-green-700 bg-green-100",
    completed: "text-blue-700 bg-blue-100",
    archived: "text-amber-700 bg-amber-100",
  };

  return (
    <AdminShell
      session={session}
      title="Grocery Engine"
      description="Monitor grocery list generation, conversion warnings, and unit health."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm text-[var(--color-muted)]">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-[var(--color-ink)]">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/grocery-engine/warnings"
          className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
        >
          View warnings
        </Link>
        <Link
          href="/admin/grocery-engine/conversions"
          className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
        >
          Unit conversions
        </Link>
      </div>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Recent grocery lists (all orgs)</h2>
        {recentLists.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">No grocery lists created yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <div className="grid grid-cols-5 border-b border-[var(--color-border)] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              <span className="col-span-2">Name</span>
              <span>Organization</span>
              <span>Items / Warnings</span>
              <span>Status</span>
            </div>
            {recentLists.map((list) => (
              <div key={list.id} className="grid grid-cols-5 border-t border-[var(--color-border)] px-4 py-3 text-sm">
                <span className="col-span-2 font-medium text-[var(--color-ink)]">{list.name}</span>
                <span className="text-[var(--color-muted)]">{list.organization.name}</span>
                <span className="text-[var(--color-muted)]">
                  {list._count.items} / {list._count.warnings}
                </span>
                <span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[list.status] ?? "text-slate-600 bg-slate-100"}`}>
                    {list.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
