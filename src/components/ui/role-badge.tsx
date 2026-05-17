import { Badge } from "@/components/ui/badge";

export function RoleBadge({ value }: { value: string }) {
  const tone =
    value.includes("owner") || value.includes("admin")
      ? "info"
      : value.includes("manager")
        ? "warning"
        : "neutral";

  return <Badge tone={tone}>{value}</Badge>;
}
