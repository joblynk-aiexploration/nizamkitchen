import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);

  const [users, organizations, countries, logs] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.country.count({ where: { isActive: true } }),
    prisma.auditLog.count(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform control plane"
        title="Admin overview"
        description="This area governs platform-wide users, countries, organizations, feature flags, auditability, and system configuration."
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={users} hint="All registered platform users." />
        <MetricCard label="Organizations" value={organizations} hint="All tenant records across the platform." />
        <MetricCard label="Active countries" value={countries} hint="Seeded countries available for expansion." />
        <MetricCard label="Audit events" value={logs} hint="Platform-wide activity captured in the audit trail." />
      </section>
    </div>
  );
}
