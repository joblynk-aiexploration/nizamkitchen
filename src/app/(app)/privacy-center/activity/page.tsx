import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUserPrivacyCenterData } from "@/server/privacy/privacy-service";
import { clearUserActivityAction } from "../../privacy/actions";

export const dynamic = "force-dynamic";

export default async function PrivacyCenterActivityPage() {
  const session = await requireMembership();
  const data = await getUserPrivacyCenterData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy center"
        title="Activity controls"
        description="Review activity connected to your account. User activity entries can be cleared; required audit logs remain preserved."
        actions={<Button asChild variant="secondary"><Link href="/privacy-center">Back</Link></Button>}
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">Clearable activity</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">These are user-facing activity entries, not security or accounting audit logs.</p>
          </div>
          <form action={clearUserActivityAction}>
            <Button type="submit" variant="secondary">Clear activity</Button>
          </form>
        </div>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {data.userActivities.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No clearable activity yet.</p> : data.userActivities.map((activity) => (
            <div key={activity.id} className="py-3 text-sm">
              <p className="font-medium text-[var(--color-ink)]">{activity.title}</p>
              <p className="text-[var(--color-muted)]">{activity.activityType.replace(/_/g, " ")} · {activity.createdAt.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Preserved account audit</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">These entries are retained for security, fraud prevention, and operational integrity.</p>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {data.auditEntries.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No account audit entries found.</p> : data.auditEntries.map((entry) => (
            <div key={entry.id} className="py-3 text-sm">
              <p className="font-medium text-[var(--color-ink)]">{entry.action.replace(/_/g, " ")}</p>
              <p className="text-[var(--color-muted)]">{entry.targetType} · {entry.createdAt.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
