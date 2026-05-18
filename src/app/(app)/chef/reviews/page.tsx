import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getChefProfileForOrganization, isChefBusiness } from "@/server/chefs";

export const dynamic = "force-dynamic";

export default async function ChefReviewsPage() {
  const session = await requireMembership();
  const enabled = await canAccessChefMarketplace({ organizationId: session.activeOrganization.id, platformRole: session.user.platformRole });
  if (!enabled || !isChefBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Reviews unavailable" description="Chef reviews are available only for enabled chef businesses." />;
  }
  const profile = await getChefProfileForOrganization(session.activeOrganization.id);
  if (!profile) return <EmptyState title="Create a chef profile first" description="Reviews attach to your chef profile." />;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Chef marketplace" title="Reviews" description="Reviews are admin moderated before publication." />
      {profile.reviews.length === 0 ? (
        <EmptyState title="No reviews yet" description="Published household reviews will appear here after admin moderation." />
      ) : (
        <div className="grid gap-4">
          {profile.reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--color-ink)]">{review.rating}/5 rating</p>
                <Badge tone={review.status === "published" ? "success" : "warning"}>{review.status}</Badge>
              </div>
              {review.comment ? <p className="mt-3 text-sm text-[var(--color-muted)]">{review.comment}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
