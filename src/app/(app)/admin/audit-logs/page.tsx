import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { CountrySelector } from "@/components/admin/country-selector";
import { OrganizationSelector } from "@/components/admin/organization-selector";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { listAdminAuditLogs } from "@/server/admin/audit-logs";

export const dynamic = "force-dynamic";

function buildAuditLogHref(
  params: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "logId") query.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      query.delete(key);
    } else {
      query.set(key, String(value));
    }
  }
  const queryString = query.toString();
  return queryString ? `/admin/audit-logs?${queryString}` : "/admin/audit-logs";
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const params = await searchParams;
  const [data, countries, organizations, users] = await Promise.all([
    listAdminAuditLogs(session, params),
    prisma.country.findMany({ select: { countryCode: true, countryName: true }, orderBy: { countryName: "asc" } }),
    prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const normalizedParams = { ...params, page: String(data.pagination.page) };
  const detailHrefBase = buildAuditLogHref(normalizedParams, { logId: undefined });
  const paginationSearchParams = { ...params, logId: undefined };
  const pagination = {
    page: data.pagination.page,
    pageSize: data.pagination.pageSize,
    totalItems: data.pagination.totalLogs,
    totalPages: data.pagination.totalPages,
    hasPreviousPage: data.pagination.hasPreviousPage,
    hasNextPage: data.pagination.hasNextPage,
    startItem: data.pagination.totalLogs === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1,
    endItem: Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.totalLogs),
  };

  return (
    <AdminShell
      session={session}
      title="Audit trail"
      description="Filter platform activity by actor, organization, country, event type, date window, and severity."
    >
      <form className="rounded-3xl border border-[var(--color-border)] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input name="action" defaultValue={params.action ?? ""} placeholder="Event type" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <CountrySelector countries={countries} defaultValue={params.countryCode ?? ""} />
          <OrganizationSelector organizations={organizations} defaultValue={params.organizationId ?? ""} />
          <select name="actorUserId" defaultValue={params.actorUserId ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
          <input name="dateFrom" type="date" defaultValue={params.dateFrom ?? ""} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <input name="dateTo" type="date" defaultValue={params.dateTo ?? ""} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <select name="severity" defaultValue={params.severity ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
            <option value="">All severities</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
          <button type="submit" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)]">
            Apply filters
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-slate-50 px-5 py-4 text-sm text-[var(--color-muted)]">
        CSV export is intentionally a placeholder in this phase. The audit dataset and filters are ready for export wiring later.
      </div>

      <div className="space-y-4">
        <PaginationControls
          pagination={pagination}
          basePath="/admin/audit-logs"
          searchParams={paginationSearchParams}
          itemLabel="activities"
          alwaysShow
        />

        <AuditLogTable
          logs={data.logs}
          selectedLogId={data.selectedLog?.id ?? null}
          detailHrefBase={detailHrefBase}
        />
        <PaginationControls
          pagination={pagination}
          basePath="/admin/audit-logs"
          searchParams={paginationSearchParams}
          itemLabel="activities"
          alwaysShow
        />
      </div>
    </AdminShell>
  );
}
