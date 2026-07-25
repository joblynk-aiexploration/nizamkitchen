import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { FeePolicyForm } from "../../pricing-forms";

export const dynamic = "force-dynamic";

export default async function NewPricingPolicyPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const query = await searchParams;
  return (
    <AdminShell session={session} title="New fee policy" description="Create a pricing policy before adding fee rules.">
      <FormMessage message={query.message} />
      <Card>
        <FeePolicyForm />
      </Card>
    </AdminShell>
  );
}
