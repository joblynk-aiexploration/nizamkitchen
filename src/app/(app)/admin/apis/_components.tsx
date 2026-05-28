import Link from "next/link";
import type { IntegrationCategory } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const apiTabs = [
  { href: "/admin/apis", label: "Overview" },
  { href: "/admin/apis/categories", label: "APIs" },
  { href: "/admin/apis/secrets", label: "Secrets" },
  { href: "/admin/apis/public-keys", label: "Public Keys" },
  { href: "/admin/apis/webhooks", label: "Webhooks" },
  { href: "/admin/apis/tests", label: "Tests" },
  { href: "/admin/apis/logs", label: "Logs" },
] as const;

export function ApiManagementTabs({ active }: { active: (typeof apiTabs)[number]["href"] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)] bg-white p-2">
      <nav className="flex min-w-max gap-2">
        {apiTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-2xl px-4 py-2 text-sm font-semibold transition",
              active === tab.href ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-ink)]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function statusTone(status: string) {
  if (status === "active" || status === "success") return "success";
  if (status === "error" || status === "failed") return "danger";
  if (status === "disabled") return "warning";
  return "neutral";
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{String(status).replace(/_/g, " ")}</Badge>;
}

export function categoryLabel(category: IntegrationCategory | string) {
  return String(category).replace(/_/g, " ");
}

export function providerLabel(provider: string) {
  return provider.replace(/_/g, " ");
}

export function scopeLabel(item: { countryCode: string | null; region?: string | null; isGlobal?: boolean }) {
  if (item.countryCode) return `${item.countryCode}${item.region ? ` / ${item.region}` : ""}`;
  return item.isGlobal ? "Global" : "Global fallback";
}
