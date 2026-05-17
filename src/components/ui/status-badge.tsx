import { Badge } from "@/components/ui/badge";

export function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "active"
      ? "success"
      : value === "paused" || value === "invited"
        ? "warning"
        : value === "disabled" || value === "removed" || value === "suspended"
          ? "danger"
          : "neutral";

  return <Badge tone={tone}>{value}</Badge>;
}
