import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card className="bg-[var(--color-card-alt)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{hint}</p>
    </Card>
  );
}
