import { BillingInterval, BillingPlanAudience, BillingPlanStatus, type BillingPlan } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { listBillingPlans } from "@/server/billing/plans";
import { billingPlanAudienceLabel } from "@/server/billing/plan-audience";
import { getPlanLimits } from "@/server/billing/plan-limits";
import { createBillingPlanAction, updateBillingPlanAction } from "./actions";

export const dynamic = "force-dynamic";

const intervalOptions = Object.values(BillingInterval).map((value) => ({ value, label: value.replace("_", " ") }));
const statusOptions = Object.values(BillingPlanStatus).map((value) => ({ value, label: value.replace("_", " ") }));
const audienceOptions = Object.values(BillingPlanAudience).map((value) => ({ value, label: billingPlanAudienceLabel(value) }));

export default async function AdminBillingPlansPage({ searchParams }: { searchParams: Promise<{ message?: string; audience?: string; status?: string; currency?: string; interval?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const query = await searchParams;
  const statusFilter = statusOptions.some((option) => option.value === query.status) ? query.status as BillingPlanStatus : undefined;
  const audienceFilter = audienceOptions.some((option) => option.value === query.audience) ? query.audience as BillingPlanAudience : undefined;
  const allPlans = await listBillingPlans(statusFilter, audienceFilter);
  const plans = allPlans.filter((plan) => {
    if (query.currency && plan.currencyCode !== query.currency.toUpperCase()) return false;
    if (query.interval && plan.billingInterval !== query.interval) return false;
    return true;
  });

  return (
    <AdminShell
      session={session}
      title="Pricing and billing plans"
      description="Platform Owner controls public pricing, subscription amounts, Stripe checkout mapping, plan limits, and plan availability."
    >
      <FormMessage message={query.message} />

      <Card>
        <form className="grid gap-4 md:grid-cols-5">
          <SelectInput label="Audience" name="audience" defaultValue={query.audience ?? ""} options={[{ value: "", label: "All audiences" }, ...audienceOptions]} />
          <SelectInput label="Status" name="status" defaultValue={query.status ?? ""} options={[{ value: "", label: "All statuses" }, ...statusOptions]} />
          <TextInput label="Currency" name="currency" maxLength={3} defaultValue={query.currency ?? ""} placeholder="USD" />
          <SelectInput label="Interval" name="interval" defaultValue={query.interval ?? ""} options={[{ value: "", label: "All intervals" }, ...intervalOptions]} />
          <div className="flex items-end">
            <Button type="submit" variant="secondary" className="w-full">Apply filters</Button>
          </div>
        </form>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Pricing control center</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Create a new pricing plan</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Set the amount customers see, choose the billing interval, and optionally connect a Stripe Price ID. If no Stripe Price ID is entered, checkout uses the plan amount directly.
            </p>
          </div>
          <Badge tone="success">Platform controlled</Badge>
        </div>
        <BillingPlanForm action={createBillingPlanAction} submitLabel="Create pricing plan" className="mt-6" />
      </Card>

      <div className="grid gap-4">
        {plans.map((plan) => (
          <PlanEditor key={plan.id} plan={plan} />
        ))}
      </div>
    </AdminShell>
  );
}

function PlanEditor({ plan }: { plan: BillingPlan }) {
  const limits = getPlanLimits(plan);
  const features = featuresText(plan);
  const priceNum = Number(plan.priceAmount);

  return (
    <Card className={plan.isPopular ? "bg-emerald-50/85 shadow-[0_18px_55px_rgba(5,150,105,0.14)]" : undefined}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-[var(--color-ink)]">{plan.name}</h2>
            <Badge tone={plan.status === "active" ? "success" : plan.status === "draft" ? "warning" : "neutral"}>{plan.status}</Badge>
            <Badge tone="info">{billingPlanAudienceLabel(plan.planAudience)}</Badge>
            {plan.isPopular ? <Badge tone="success">Featured popular plan</Badge> : null}
            <Badge tone="neutral">{plan.slug}</Badge>
            {plan.stripePriceId ? <Badge tone="info">Stripe Price linked</Badge> : <Badge tone="warning">Uses plan amount</Badge>}
          </div>
          {plan.description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{plan.description}</p> : null}
          <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
            {priceNum === 0 ? "Free" : `${plan.currencyCode} ${priceNum.toFixed(2)} / ${plan.billingInterval}`}
          </p>
        </div>

        <div className="grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-3 lg:min-w-[440px]">
          <Metric label="Meal plans" value={limitText(limits.maxMealPlans)} />
          <Metric label="Grocery lists/mo" value={limitText(limits.maxGroceryListsPerMonth)} />
          <Metric label="Chef requests/mo" value={limitText(limits.maxChefRequestsPerMonth)} />
        </div>
      </div>

      {features ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {features.split("\n").map((feature) => (
            <span key={feature} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
              {feature}
            </span>
          ))}
        </div>
      ) : null}

      <details className="mt-5 rounded-2xl border border-[var(--color-border)] bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--color-ink)]">
          Edit pricing, checkout, limits, and features
        </summary>
        <div className="border-t border-[var(--color-border)] p-4">
          <BillingPlanForm
            action={updateBillingPlanAction}
            plan={plan}
            submitLabel="Save pricing plan"
          />
        </div>
      </details>
    </Card>
  );
}

function BillingPlanForm({
  action,
  plan,
  submitLabel,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  plan?: BillingPlan;
  submitLabel: string;
  className?: string;
}) {
  const limits = plan ? getPlanLimits(plan) : null;
  return (
    <form action={action} className={`grid gap-4 md:grid-cols-2 ${className ?? ""}`}>
      {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
      <TextInput label="Plan name" name="name" defaultValue={plan?.name ?? ""} placeholder="Family Plus" required />
      <TextInput label="Slug" name="slug" defaultValue={plan?.slug ?? ""} placeholder="family-plus" pattern="[a-z0-9-]+" hint="Lowercase letters, numbers, and dashes only." required />
      <TextInput label="Price amount" name="priceAmount" type="number" min="0" step="0.01" defaultValue={plan ? Number(plan.priceAmount) : 0} required />
      <TextInput label="Currency" name="currencyCode" maxLength={3} defaultValue={plan?.currencyCode ?? "USD"} required />
      <SelectInput label="Plan audience" name="planAudience" defaultValue={plan?.planAudience ?? "household"} options={audienceOptions} required />
      <SelectInput label="Billing interval" name="billingInterval" defaultValue={plan?.billingInterval ?? "monthly"} options={intervalOptions} />
      <SelectInput label="Status" name="status" defaultValue={plan?.status ?? "draft"} options={statusOptions} />
      <label className="flex min-h-[4.7rem] items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <input
          type="checkbox"
          name="isPopular"
          defaultChecked={plan?.isPopular ?? false}
          className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-[var(--focus-ring)]"
        />
        <span>
          Feature as Popular plan
          <span className="block text-xs font-medium leading-5 text-emerald-800">
            Shows a Popular badge and turns the public pricing card green for this account type.
          </span>
        </span>
      </label>
      <TextInput
        label="Stripe Price ID"
        name="stripePriceId"
        defaultValue={plan?.stripePriceId ?? ""}
        placeholder="price_..."
        hint="Optional. If blank, Stripe checkout uses this plan amount directly."
      />
      <div className="md:col-span-2">
        <TextArea label="Description" name="description" defaultValue={plan?.description ?? ""} />
      </div>

      <PlanLimitInputs limits={limits} />

      <div className="md:col-span-2">
        <TextArea
          label="Included features"
          name="featuresText"
          defaultValue={plan ? featuresText(plan) : ""}
          rows={6}
          placeholder={"One feature per line\nAdvanced grocery exports\nPriority support"}
        />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

function PlanLimitInputs({ limits }: { limits: ReturnType<typeof getPlanLimits> | null }) {
  return (
    <div className="md:col-span-2 grid gap-4 rounded-2xl border border-[var(--color-border)] bg-white p-4 md:grid-cols-3">
      <TextInput label="Meal plans" name="maxMealPlans" type="number" min="-1" step="1" defaultValue={limits?.maxMealPlans ?? 2} hint="-1 means unlimited." />
      <TextInput label="Grocery lists/month" name="maxGroceryListsPerMonth" type="number" min="-1" step="1" defaultValue={limits?.maxGroceryListsPerMonth ?? 5} hint="-1 means unlimited." />
      <TextInput label="Household members" name="maxHouseholdMembers" type="number" min="-1" step="1" defaultValue={limits?.maxHouseholdMembers ?? 1} />
      <TextInput label="Saved restaurants" name="maxSavedRestaurants" type="number" min="-1" step="1" defaultValue={limits?.maxSavedRestaurants ?? 5} />
      <TextInput label="Chef requests/month" name="maxChefRequestsPerMonth" type="number" min="-1" step="1" defaultValue={limits?.maxChefRequestsPerMonth ?? 0} />
      <div className="space-y-3 text-sm font-medium text-[var(--color-ink)]">
        <label className="flex items-center gap-2"><input type="checkbox" name="chefMarketplaceEnabled" defaultChecked={limits?.chefMarketplaceEnabled ?? false} /> Chef marketplace</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="groceryExportsEnabled" defaultChecked={limits?.groceryExportsEnabled ?? false} /> Grocery exports</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="restaurantFallbackEnabled" defaultChecked={limits?.restaurantFallbackEnabled ?? false} /> Restaurant fallback</label>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

function limitText(value: number) {
  return value === -1 ? "Unlimited" : String(value);
}

function featuresText(plan: BillingPlan) {
  return Array.isArray(plan.featuresJson) ? plan.featuresJson.map(String).join("\n") : "";
}
