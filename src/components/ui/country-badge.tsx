import { Badge } from "@/components/ui/badge";

export function CountryBadge({
  countryCode,
  countryName,
}: {
  countryCode: string;
  countryName?: string | null;
}) {
  return <Badge tone="info">{countryName ? `${countryName} (${countryCode})` : countryCode}</Badge>;
}
