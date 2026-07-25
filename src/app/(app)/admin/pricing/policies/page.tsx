import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { listFeePolicies } from "@/server/pricing/fee-policy-service";
import { labelize } from "../pricing-forms";

export const dynamic = "force-dynamic";

export default async function PricingPoliciesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const query = await searchParams;
  const policies = await listFeePolicies();

  return (
    <AdminShell session={session} title="Fee policies" description="Manage checkout pricing policies by module, location, seller type, and fulfillment type." actions={<Button asChild><Link href="/admin/pricing/policies/new">New policy</Link></Button>}>
      <FormMessage message={query.message} />
      <div className="grid gap-4">
        {policies.map((policy) => (
          <Card key={policy.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--color-ink)]">{policy.name}</h2>
                  <Badge tone={policy.status === "active" ? "success" : policy.status === "draft" ? "warning" : "neutral"}>{labelize(policy.status)}</Badge>
                  <Badge tone="info">{labelize(policy.module)}</Badge>
                  {policy.sellerType ? <Badge tone="neutral">{labelize(policy.sellerType)}</Badge> : null}
                  {policy.fulfillmentType ? <Badge tone="neutral">{labelize(policy.fulfillmentType)}</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{policy.description ?? "No description."}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Scope: {[policy.countryCode, policy.region, policy.city].filter(Boolean).join(" / ") || "Global"} · Priority {policy.priority}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{policy.rules.length} rule(s)</Badge>
                <Button asChild variant="secondary"><Link href={`/admin/pricing/policies/${policy.id}`}>Manage</Link></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
