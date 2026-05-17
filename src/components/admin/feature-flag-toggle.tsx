import { Badge } from "@/components/ui/badge";

export function FeatureFlagToggle({
  enabled,
  scope,
}: {
  enabled: boolean;
  scope: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "enabled" : "disabled"}</Badge>
      <Badge tone="info">{scope}</Badge>
    </div>
  );
}
