import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaginationInput, getPaginationMeta } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { PaginationControls } from "@/components/ui/pagination-controls";

export const dynamic = "force-dynamic";

export default async function AdminConversionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const params = await searchParams;
  const paginationInput = getPaginationInput({ page: params.page });

  const [totalConversions, conversions] = await Promise.all([
    prisma.unitConversion.count(),
    prisma.unitConversion.findMany({
      include: {
        fromUnit: true,
        toUnit: true,
        ingredient: { select: { canonicalName: true } },
      },
      orderBy: [{ fromUnit: { type: "asc" } }, { fromUnit: { name: "asc" } }],
      skip: paginationInput.skip,
      take: paginationInput.take,
    }),
  ]);

  const byType = new Map<string, typeof conversions>();
  for (const conv of conversions) {
    const type = conv.fromUnit.type;
    const group = byType.get(type) ?? [];
    group.push(conv);
    byType.set(type, group);
  }

  const CONF_TONE = (n: number): "success" | "warning" | "danger" | "neutral" =>
    n >= 0.99 ? "success" : n >= 0.8 ? "warning" : "danger";

  return (
    <AdminShell
      session={session}
      title="Unit Conversions"
      description="All global and ingredient-specific unit conversions used by the grocery engine."
    >
      {Array.from(byType.entries()).map(([type, convs]) => (
        <Card key={type}>
          <h2 className="font-semibold capitalize text-[var(--color-ink)]">{type} conversions ({convs.length})</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <div className="grid grid-cols-5 border-b border-[var(--color-border)] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              <span>From</span>
              <span>To</span>
              <span>Multiplier</span>
              <span>Ingredient</span>
              <span>Confidence</span>
            </div>
            {convs.map((conv) => (
              <div key={conv.id} className="grid grid-cols-5 border-t border-[var(--color-border)] px-4 py-3 text-sm">
                <span className="font-medium">{conv.fromUnit.name} ({conv.fromUnit.symbol ?? conv.fromUnit.code})</span>
                <span className="font-medium">{conv.toUnit.name} ({conv.toUnit.symbol ?? conv.toUnit.code})</span>
                <span className="font-mono">{conv.multiplier}</span>
                <span className="text-[var(--color-muted)]">
                  {conv.ingredient ? conv.ingredient.canonicalName : <span className="italic">global</span>}
                </span>
                <span>
                  <Badge tone={CONF_TONE(conv.confidence)}>
                    {(conv.confidence * 100).toFixed(0)}%
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {conversions.length === 0 && (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No unit conversions found. Run the database seed to add standard conversions.</p>
        </Card>
      )}
      <PaginationControls
        pagination={getPaginationMeta(totalConversions, paginationInput)}
        basePath="/admin/grocery-engine/conversions"
        searchParams={params}
        itemLabel="conversions"
      />
    </AdminShell>
  );
}
