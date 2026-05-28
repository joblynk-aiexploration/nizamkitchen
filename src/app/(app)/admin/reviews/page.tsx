import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminReviews, reviewStars } from "@/server/trust/review-service";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string; sellerType?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const reviews = await listAdminReviews(session, params);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Reviews moderation"
        description="Moderate verified-purchase marketplace reviews, seller replies, reports, and rating visibility."
        actions={<Button asChild variant="secondary"><Link href="/admin/reviews/reports">Review reports</Link></Button>}
      />
      {reviews.length === 0 ? <EmptyState title="No reviews" description="Completed order/request reviews will appear here after submission." /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="py-3 pr-4">Review</th>
                <th className="py-3 pr-4">Seller</th>
                <th className="py-3 pr-4">Customer</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Reports</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[var(--color-ink)]">{reviewStars(review.rating)}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{review.subjectType.replace(/_/g, " ")}</p>
                  </td>
                  <td className="py-4 pr-4">{review.sellerOrganization.name}</td>
                  <td className="py-4 pr-4">{review.customerOrganization.name}</td>
                  <td className="py-4 pr-4"><Badge tone={review.status === "published" ? "success" : review.status === "removed" ? "danger" : "warning"}>{review.status}</Badge></td>
                  <td className="py-4 pr-4">{review.reports.length}</td>
                  <td className="py-4"><Button asChild variant="secondary"><Link href={`/admin/reviews/${review.id}`}>Open</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
