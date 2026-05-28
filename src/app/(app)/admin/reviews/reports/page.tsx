import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminReviewReports } from "@/server/trust/review-service";
import { updateReviewReportAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const reports = await listAdminReviewReports(session, params);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Review reports" description="Handle complaint/report submissions about published marketplace reviews." />
      {reports.length === 0 ? <EmptyState title="No review reports" description="Reported reviews and complaints will appear here." /> : null}
      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="warning">{report.reason.replace(/_/g, " ")}</Badge>
                  <Badge tone={report.status === "resolved" ? "success" : "warning"}>{report.status}</Badge>
                </div>
                <h2 className="mt-3 font-semibold text-[var(--color-ink)]">{report.review.sellerOrganization.name}</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{report.details ?? "No additional details."}</p>
                <Button asChild variant="secondary" className="mt-4"><Link href={`/admin/reviews/${report.reviewId}`}>Open review</Link></Button>
              </div>
              <form action={updateReviewReportAction} className="space-y-3">
                <input type="hidden" name="reportId" value={report.id} />
                <SelectInput label="Report status" name="status" defaultValue={report.status} options={[
                  { value: "open", label: "Open" },
                  { value: "under_review", label: "Under review" },
                  { value: "resolved", label: "Resolved" },
                  { value: "dismissed", label: "Dismissed" },
                ]} />
                <TextArea label="Resolution note" name="resolutionNote" defaultValue={report.resolutionNote ?? ""} />
                <Button type="submit">Save report</Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
