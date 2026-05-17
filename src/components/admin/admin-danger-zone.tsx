import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AdminDangerZone({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50/70">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-rose-950">{title}</h2>
          <p className="mt-2 text-sm text-rose-900/70">{description}</p>
          <div className="mt-4 flex flex-wrap gap-3">{children}</div>
        </div>
      </div>
    </Card>
  );
}
