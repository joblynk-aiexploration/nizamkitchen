import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AdminMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <p className="mt-4 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{hint}</p>
        </div>
        <div className="rounded-2xl bg-[var(--color-primary)]/10 p-2 text-[var(--color-primary)]">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
