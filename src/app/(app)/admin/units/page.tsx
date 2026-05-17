import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { listUnits } from "@/server/units";

export const dynamic = "force-dynamic";

const TYPE_TONES: Record<string, "info" | "neutral" | "warning" | "success" | "danger"> = {
  mass: "info",
  volume: "success",
  count: "warning",
  package: "neutral",
  custom: "neutral",
  length: "neutral",
};

export default async function AdminUnitsPage({
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

  const units = await listUnits({
    type: params.type as never,
    system: params.system as never,
  });

  return (
    <AdminShell
      session={session}
      title="Unit library"
      description="Mass, volume, count, and traditional cooking units. Conversions between these are the foundation of the grocery engine."
    >
      <AdminFilterBar searchPlaceholder="">
        <select
          name="type"
          defaultValue={params.type ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All types</option>
          <option value="mass">Mass</option>
          <option value="volume">Volume</option>
          <option value="count">Count</option>
          <option value="package">Package</option>
          <option value="custom">Custom / Traditional</option>
        </select>
        <select
          name="system"
          defaultValue={params.system ?? ""}
          className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
        >
          <option value="">All systems</option>
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
          <option value="traditional">Traditional</option>
          <option value="mixed">Mixed</option>
        </select>
      </AdminFilterBar>

      <AdminDataTable
        data={units}
        emptyMessage="No units matched the current filters."
        columns={[
          {
            key: "unit",
            header: "Unit",
            render: (u) => (
              <div>
                <Link
                  href={`/admin/units/${u.id}`}
                  className="font-semibold text-[var(--color-primary)]"
                >
                  {u.name}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">
                  {u.pluralName} · code: {u.code}
                  {u.symbol ? ` · symbol: ${u.symbol}` : ""}
                </p>
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (u) => (
              <Badge tone={TYPE_TONES[u.type] ?? "neutral"}>{u.type}</Badge>
            ),
          },
          {
            key: "system",
            header: "System",
            render: (u) => <Badge tone="neutral">{u.system}</Badge>,
          },
          {
            key: "flags",
            header: "Flags",
            render: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.isBaseUnit && <Badge tone="info">base unit</Badge>}
                {u.isGlobal && <Badge tone="success">global</Badge>}
              </div>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
