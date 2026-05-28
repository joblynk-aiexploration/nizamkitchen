import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listUsageRecords } from "@/server/billing/usage";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BillingUsagePage() {
  const session = await requireMembership();
  const records = await listUsageRecords(session.activeOrganization.id, 100);

  const usageTypeLabel: Record<string, string> = {
    meal_plan_created: "Meal plan created",
    grocery_list_created: "Grocery list created",
    grocery_list_exported: "Grocery list exported",
    chef_request_submitted: "Chef request submitted",
    restaurant_search: "Restaurant search",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Usage history"
        description="Usage events recorded against your plan limits."
      />

      {records.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">
            No usage records yet. Usage is recorded as you use paid features.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-[var(--color-border)]">
            {records.map((record) => (
              <div key={record.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">
                    {usageTypeLabel[record.usageType] ?? record.usageType}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    Period: {formatDate(record.periodStart)} – {formatDate(record.periodEnd)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  ×{record.quantity}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
