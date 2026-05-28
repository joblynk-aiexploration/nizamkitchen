import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/emails", label: "Overview" },
  { href: "/admin/emails/templates", label: "Templates" },
  { href: "/admin/emails/logs", label: "Logs" },
  { href: "/admin/emails/preferences", label: "Preferences" },
  { href: "/admin/emails/suppressions", label: "Suppressions" },
  { href: "/admin/emails/test-send", label: "Test send" },
] as const;

export function EmailCenterTabs({ active }: { active: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-white p-2">
      <nav className="flex min-w-max gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              active === tab.href
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function EmailStatusBadge({ status }: { status: string }) {
  const tone =
    status === "sent" || status === "active"
      ? "success"
      : status === "failed" || status === "archived"
        ? "danger"
        : status === "skipped" || status === "suppressed" || status === "draft"
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function emailProviderLabel(provider: string) {
  return provider.replace(/_/g, " ");
}
