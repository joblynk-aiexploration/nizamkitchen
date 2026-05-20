import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAdminPrivacyRequest } from "@/server/privacy/privacy-service";
import {
  anonymizeOrganizationAction,
  anonymizeUserAction,
  generatePrivacyExportAction,
  updatePrivacyRequestAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const { id } = await params;
  const request = await getAdminPrivacyRequest(session, id);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title={request.requestType.replace(/_/g, " ")}
      description="Review and complete privacy requests without unsafe deletion of payment, audit, or KYC records."
      actions={<Button asChild variant="secondary"><Link href="/admin/privacy/requests">Back to requests</Link></Button>}
    >
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Requested by {request.requestedBy.email} on {request.createdAt.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--color-ink)]">{request.reason ?? "No reason provided."}</p>
          </div>
          <StatusBadge value={request.status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="neutral">{request.countryCode ?? "global"}</Badge>
          <Badge tone="neutral">{request.organization?.name ?? "user scoped"}</Badge>
          {request.exportFile ? <Badge tone="success">private export generated</Badge> : null}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Retention safeguards</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Do not delete payment ledger records needed for accounting.</p>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Do not delete audit logs when retention requires keeping them.</p>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">KYC/background-check records may have provider/legal retention requirements.</p>
        </div>
      </Card>

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Admin review</h2>
            <form action={updatePrivacyRequestAction.bind(null, request.id)} className="mt-4 space-y-4">
              <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
                Status
                <select name="status" defaultValue={request.status} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                  {["submitted", "reviewing", "processing", "completed", "rejected", "cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-ink)]">
                Admin notes
                <textarea name="adminNotes" defaultValue={request.adminNotes ?? ""} rows={5} className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm" />
              </label>
              <Button type="submit">Save review</Button>
            </form>
          </Card>
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Controlled actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {(request.requestType === "user_export" || request.requestType === "organization_export") ? (
                <form action={generatePrivacyExportAction.bind(null, request.id)}><Button type="submit">Generate private export</Button></form>
              ) : null}
              {(request.requestType === "account_deletion" || request.requestType === "anonymization") ? (
                <form action={anonymizeUserAction.bind(null, request.id)}><Button type="submit" variant="secondary">Anonymize user</Button></form>
              ) : null}
              {request.requestType === "organization_deletion" ? (
                <form action={anonymizeOrganizationAction.bind(null, request.id)}><Button type="submit" variant="secondary">Anonymize organization</Button></form>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-[var(--color-muted)]">Actions are audited. Exports are private StorageFile records and do not include secrets or raw KYC document contents.</p>
          </Card>
        </div>
      ) : null}
    </AdminShell>
  );
}
