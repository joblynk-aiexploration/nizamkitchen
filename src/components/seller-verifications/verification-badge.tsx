import { Badge } from "@/components/ui/badge";

export function SellerVerificationBadge({ label, tone = "neutral" }: { label: string; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return <Badge tone={tone}>{label}</Badge>;
}
