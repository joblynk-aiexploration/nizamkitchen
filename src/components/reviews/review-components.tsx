import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { reviewStars } from "@/server/trust/review-service";

type Action = (formData: FormData) => void | Promise<void>;

export function ReviewCreateForm({
  action,
  foodOrderId,
  homeChefRequestId,
}: {
  action: Action;
  foodOrderId?: string;
  homeChefRequestId?: string;
}) {
  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <form action={action} className="space-y-4">
        <div>
          <h2 className="font-semibold text-emerald-950">Leave a verified review</h2>
          <p className="mt-1 text-sm text-emerald-800">Reviews are allowed only after completed orders or requests and are moderated before publication.</p>
        </div>
        {foodOrderId ? <input type="hidden" name="foodOrderId" value={foodOrderId} /> : null}
        {homeChefRequestId ? <input type="hidden" name="homeChefRequestId" value={homeChefRequestId} /> : null}
        <SelectInput label="Rating" name="rating" options={ratingOptions} defaultValue="5" />
        <TextInput label="Review title" name="title" maxLength={140} />
        <TextArea label="Review" name="comment" maxLength={2000} />
        <Button type="submit">Submit review</Button>
      </form>
    </Card>
  );
}

export function SellerReplyForm({ action, reviewId }: { action: Action; reviewId: string }) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reviewId" value={reviewId} />
      <TextArea label="Seller reply" name="reply" maxLength={1500} required />
      <Button type="submit" variant="secondary">Reply to review</Button>
    </form>
  );
}

export function ReviewReportForm({ action, reviewId }: { action: Action; reviewId: string }) {
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-[var(--color-border)] p-4">
      <input type="hidden" name="reviewId" value={reviewId} />
      <SelectInput label="Report reason" name="reason" options={reportReasonOptions} defaultValue="other" />
      <TextArea label="Details" name="details" maxLength={1500} />
      <Button type="submit" variant="secondary">Report review</Button>
    </form>
  );
}

export function PublicReviewList({
  reviews,
  emptyLabel = "Reviews will appear here after completed orders.",
}: {
  reviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    comment: string | null;
    sellerReply: string | null;
    createdAt: Date;
    reviewer?: { fullName: string } | null;
    customerOrganization?: { name: string } | null;
  }>;
  emptyLabel?: string;
}) {
  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-ink)]">Verified reviews</h2>
      {reviews.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">{emptyLabel}</p> : null}
      <div className="mt-5 space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--color-ink)]">{reviewStars(review.rating)}</span>
              <Badge tone="success">Verified purchase</Badge>
            </div>
            {review.title ? <p className="mt-3 font-semibold text-[var(--color-ink)]">{review.title}</p> : null}
            {review.comment ? <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{review.comment}</p> : null}
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              {review.customerOrganization?.name ?? review.reviewer?.fullName ?? "Customer"} · {review.createdAt.toLocaleDateString()}
            </p>
            {review.sellerReply ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seller reply</p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{review.sellerReply}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RatingSummary({ averageRating, ratingCount }: { averageRating: number | null; ratingCount: number }) {
  if (!averageRating || ratingCount === 0) {
    return <Badge tone="neutral">No verified ratings yet</Badge>;
  }
  return <Badge tone="success">{averageRating.toFixed(1)} / 5 · {ratingCount} verified reviews</Badge>;
}

const ratingOptions = [
  { value: "5", label: "5 - Excellent" },
  { value: "4", label: "4 - Good" },
  { value: "3", label: "3 - Okay" },
  { value: "2", label: "2 - Poor" },
  { value: "1", label: "1 - Bad" },
];

const reportReasonOptions = [
  { value: "other", label: "Other" },
  { value: "abuse", label: "Abuse or harassment" },
  { value: "spam", label: "Spam" },
  { value: "fake_review", label: "Fake review concern" },
  { value: "privacy", label: "Privacy issue" },
  { value: "safety", label: "Safety concern" },
];
