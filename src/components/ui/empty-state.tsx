import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-start gap-4 border-dashed">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      {action}
    </Card>
  );
}
