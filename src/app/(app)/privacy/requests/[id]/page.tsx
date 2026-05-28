import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getUserPrivacyRequest } from "@/server/privacy/privacy-service";

export const dynamic = "force-dynamic";

export default async function PrivacyRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  const { id } = await params;
  const request = await getUserPrivacyRequest(session, id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy request"
        title={request.requestType.replace(/_/g, " ")}
        description="Privacy requests are reviewed before data is exported, anonymized, archived, or corrected."
      />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Submitted {request.createdAt.toLocaleString()}</p>
            <p className="mt-2 text-sm text-[var(--color-ink)]">{request.reason ?? "No reason provided."}</p>
          </div>
          <StatusBadge value={request.status} />
        </div>
        {request.exportFile ? (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Your export has been generated and is stored privately. Contact support if you need a download link.
          </p>
        ) : null}
        {request.adminNotes ? <p className="mt-4 text-sm text-[var(--color-muted)]">Admin note: {request.adminNotes}</p> : null}
      </Card>
    </div>
  );
}
