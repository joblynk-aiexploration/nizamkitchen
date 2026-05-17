import { Card } from "@/components/ui/card";

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <Card className="animate-pulse">
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="mt-4 h-3 w-full rounded bg-slate-100" />
      <div className="mt-2 h-3 w-3/4 rounded bg-slate-100" />
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </Card>
  );
}
