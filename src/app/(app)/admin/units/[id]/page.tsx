import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { getUnitById } from "@/server/units";

export const dynamic = "force-dynamic";

export default async function AdminUnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);
  const { id } = await params;
  const unit = await getUnitById(id);

  if (!unit) notFound();

  return (
    <AdminShell
      session={session}
      title={unit.name}
      description={`${unit.type} · ${unit.system}${unit.symbol ? ` · ${unit.symbol}` : ""}`}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="font-semibold">Unit details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Code</dt>
              <dd className="font-mono">{unit.code}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Name</dt>
              <dd>{unit.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Plural</dt>
              <dd>{unit.pluralName}</dd>
            </div>
            {unit.symbol && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted)]">Symbol</dt>
                <dd>{unit.symbol}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Type</dt>
              <dd><Badge tone="neutral">{unit.type}</Badge></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">System</dt>
              <dd><Badge tone="neutral">{unit.system}</Badge></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Base unit</dt>
              <dd><Badge tone={unit.isBaseUnit ? "info" : "neutral"}>{unit.isBaseUnit ? "Yes" : "No"}</Badge></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Global</dt>
              <dd><Badge tone={unit.isGlobal ? "success" : "neutral"}>{unit.isGlobal ? "Yes" : "No"}</Badge></dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="font-semibold">
            Conversions from this unit ({unit.conversionsFrom.length})
          </h2>
          {unit.conversionsFrom.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">No conversions defined from this unit.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)]">
              <div className="grid grid-cols-4 border-b border-[var(--color-border)] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                <span>To unit</span>
                <span>Multiplier</span>
                <span>Confidence</span>
                <span>Scope</span>
              </div>
              {unit.conversionsFrom.map((conv) => (
                <div key={conv.id} className="grid grid-cols-4 items-start border-t border-[var(--color-border)] px-4 py-3 text-sm">
                  <span className="font-medium">{conv.toUnit.name}</span>
                  <span className="font-mono">{conv.multiplier}</span>
                  <span>{(conv.confidence * 100).toFixed(0)}%</span>
                  <span>
                    {conv.ingredient ? (
                      <Badge tone="warning">ingredient-specific</Badge>
                    ) : (
                      <Badge tone="info">global</Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Piece/count to mass conversions require ingredient-specific data and are stored on individual ingredients, not here.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
