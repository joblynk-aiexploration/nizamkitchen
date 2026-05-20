import Link from "next/link";
import type { DataPrivacyRequestStatus, DataPrivacyRequestType } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminPrivacyRequests } from "@/server/privacy/privacy-service";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; requestType?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const params = await searchParams;
  const requests = await listAdminPrivacyRequests(session, {
    status: params.status as DataPrivacyRequestStatus | undefined,
    requestType: params.requestType as DataPrivacyRequestType | undefined,
  });

  return (
    <AdminShell
      session={session}
      title="Privacy Requests"
      description="Review user and organization data export, correction, deletion, and anonymization requests."
      actions={<Button asChild variant="secondary"><Link href="/admin/privacy/retention">Retention policies</Link></Button>}
    >
      <form className="grid gap-4 rounded-3xl border border-[var(--color-border)] bg-white p-4 md:grid-cols-3">
        <SelectInput label="Status" name="status" defaultValue={params.status ?? ""} options={[
          { value: "", label: "All statuses" },
          { value: "submitted", label: "Submitted" },
          { value: "reviewing", label: "Reviewing" },
          { value: "processing", label: "Processing" },
          { value: "completed", label: "Completed" },
          { value: "rejected", label: "Rejected" },
          { value: "cancelled", label: "Cancelled" },
        ]} />
        <SelectInput label="Type" name="requestType" defaultValue={params.requestType ?? ""} options={[
          { value: "", label: "All types" },
          { value: "user_export", label: "User export" },
          { value: "organization_export", label: "Organization export" },
          { value: "account_deletion", label: "Account deletion" },
          { value: "organization_deletion", label: "Organization deletion" },
          { value: "anonymization", label: "Anonymization" },
          { value: "file_deletion", label: "File deletion" },
          { value: "correction_request", label: "Correction" },
        ]} />
        <div className="flex items-end"><Button type="submit" variant="secondary">Filter</Button></div>
      </form>
      <AdminDataTable
        data={requests}
        emptyMessage="No privacy requests found."
        columns={[
          {
            key: "request",
            header: "Request",
            render: (request) => (
              <div>
                <Link href={`/admin/privacy/requests/${request.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                  {request.requestType.replace(/_/g, " ")}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">{request.requestedBy.email}</p>
              </div>
            ),
          },
          { key: "status", header: "Status", render: (request) => <StatusBadge value={request.status} /> },
          { key: "scope", header: "Scope", render: (request) => <span className="text-sm">{request.organization?.name ?? request.user?.email ?? "User"}</span> },
          { key: "country", header: "Country", render: (request) => <Badge tone="neutral">{request.countryCode ?? "global"}</Badge> },
          { key: "created", header: "Created", render: (request) => <span className="text-sm text-[var(--color-muted)]">{request.createdAt.toLocaleDateString()}</span> },
        ]}
      />
    </AdminShell>
  );
}
