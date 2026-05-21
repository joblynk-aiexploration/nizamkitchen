import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminReview, reviewStars } from "@/server/trust/review-service";
import { updateReviewModerationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const review = await getAdminReview(session, id);
  if (!review) notFound();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Review detail" description="Moderate verified-purchase review content, seller replies, and report activity." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--color-ink)]">{reviewStars(review.rating)}</span>
            <Badge tone="success">Verified purchase</Badge>
            <Badge tone={review.status === "published" ? "success" : review.status === "removed" ? "danger" : "warning"}>{review.status}</Badge>
          </div>
          <h2 className="mt-5 text-xl font-semibold text-[var(--color-ink)]">{review.title ?? "Untitled review"}</h2>
          {review.comment ? <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{review.comment}</p> : null}
          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <Info label="Seller" value={review.sellerOrganization.name} />
            <Info label="Customer" value={review.customerOrganization.name} />
            <Info label="Reviewer" value={review.reviewer.email} />
            <Info label="Subject" value={review.subjectType.replace(/_/g, " ")} />
            <Info label="Food order" value={review.foodOrder?.id ?? "N/A"} />
            <Info label="Home chef request" value={review.homeChefRequest?.title ?? "N/A"} />
          </dl>
          {review.sellerReply ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seller reply</p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{review.sellerReply}</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">By {review.sellerReplyBy?.email ?? "seller"}</p>
            </div>
          ) : null}
        </Card>
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Moderation</h2>
          <form action={updateReviewModerationAction} className="mt-4 space-y-4">
            <input type="hidden" name="reviewId" value={review.id} />
            <SelectInput label="Status" name="status" defaultValue={review.status} options={[
              { value: "pending", label: "Pending" },
              { value: "published", label: "Published" },
              { value: "hidden", label: "Hidden" },
              { value: "removed", label: "Removed" },
            ]} />
            <TextArea label="Moderation note" name="moderationNote" defaultValue={review.moderationNote ?? ""} />
            <Button type="submit">Save moderation</Button>
          </form>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Reports</h2>
        <div className="mt-4 grid gap-3">
          {review.reports.map((report) => (
            <div key={report.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{report.reason.replace(/_/g, " ")}</Badge>
                <Badge tone={report.status === "resolved" ? "success" : "warning"}>{report.status}</Badge>
              </div>
              {report.details ? <p className="mt-2 text-sm text-[var(--color-muted)]">{report.details}</p> : null}
              <p className="mt-2 text-xs text-[var(--color-muted)]">Reported by {report.reporter.email}</p>
            </div>
          ))}
          {review.reports.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No reports for this review.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}
