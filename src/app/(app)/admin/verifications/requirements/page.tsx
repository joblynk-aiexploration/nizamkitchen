import Link from "next/link";
import { SellerRequirementType, SellerType, VerificationProvider } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listSellerVerificationPolicies } from "@/server/seller-verification-gates";
import { saveSellerVerificationPolicyAction } from "../../../seller-verification-actions";

export const dynamic = "force-dynamic";

export default async function VerificationRequirementsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [session, params, requirements, policies] = await Promise.all([
    requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]),
    searchParams,
    prisma.sellerVerificationRequirement.findMany({ orderBy: [{ sellerType: "asc" }, { countryCode: "asc" }, { sortOrder: "asc" }] }),
    listSellerVerificationPolicies(),
  ]);
  const canEditPolicy = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";
  return (
    <AdminShell session={session} title="Verification requirements" description="Configure country, region, and seller-type compliance requirements.">
      {params.message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{params.message}</div> : null}
      <div><Button asChild><Link href="/admin/verifications/requirements/new">New requirement</Link></Button></div>
      {canEditPolicy ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Marketplace gate policy</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Policies decide whether public profiles, menu publishing, order acceptance, and payouts require completed verification.</p>
          <form action={saveSellerVerificationPolicyAction} className="mt-5 grid gap-4 md:grid-cols-3">
            <TextInput label="Policy name" name="policyName" placeholder="US home catering launch policy" required />
            <SelectInput label="Seller type" name="sellerType" options={sellerTypeOptions} />
            <SelectInput label="Status" name="status" options={[{ value: "active", label: "active" }, { value: "disabled", label: "disabled" }]} />
            <TextInput label="Country" name="countryCode" placeholder="US or blank global" />
            <TextInput label="Region" name="region" placeholder="TX or blank" />
            <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
              {[
                ["requireAdminApproval", "Require admin approval"],
                ["requireIdentityVerification", "Require identity verification"],
                ["requireFoodHandlerCertificate", "Require food handler certificate"],
                ["requireLocalPermit", "Require local permit"],
                ["requireKitchenReview", "Require kitchen review"],
                ["requireBackgroundCheck", "Require background check"],
                ["requirePayoutOnboarding", "Require payout onboarding"],
                ["allowPublicProfileBeforeVerification", "Allow public profile while pending"],
                ["allowMenuPublishingBeforeVerification", "Allow menu publishing while pending"],
                ["allowOrderAcceptanceBeforeVerification", "Allow order acceptance while pending"],
                ["allowPayoutsBeforeVerification", "Allow payouts while pending"],
              ].map(([name, label]) => (
                <label key={name} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                  <input type="checkbox" name={name} className="mr-2" defaultChecked={name === "requireAdminApproval"} />
                  {label}
                </label>
              ))}
            </div>
            <Button type="submit" className="md:col-span-3">Save policy</Button>
          </form>
        </Card>
      ) : null}
      <AdminDataTable
        data={policies}
        emptyMessage="No marketplace gate policies configured yet."
        columns={[
          { key: "name", header: "Policy", render: (item) => item.policyName },
          { key: "seller", header: "Seller type", render: (item) => item.sellerType.replace(/_/g, " ") },
          { key: "scope", header: "Scope", render: (item) => `${item.countryCode ?? "global"}${item.region ? ` / ${item.region}` : ""}` },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "active" ? "success" : "neutral"}>{item.status}</Badge> },
          { key: "gates", header: "Blocked before verification", render: (item) => [
            !item.allowPublicProfileBeforeVerification ? "profile" : null,
            !item.allowMenuPublishingBeforeVerification ? "menus" : null,
            !item.allowOrderAcceptanceBeforeVerification ? "orders" : null,
            !item.allowPayoutsBeforeVerification ? "payouts" : null,
          ].filter(Boolean).join(", ") || "None" },
        ]}
      />
      <AdminDataTable
        data={requirements}
        emptyMessage="No configured requirements yet. Sellers will see safe default requirements."
        columns={[
          { key: "title", header: "Title", render: (item) => item.title },
          { key: "seller", header: "Seller type", render: (item) => item.sellerType.replace(/_/g, " ") },
          { key: "type", header: "Requirement type", render: (item) => item.requirementType.replace(/_/g, " ") },
          { key: "scope", header: "Scope", render: (item) => `${item.countryCode ?? "global"}${item.region ? ` / ${item.region}` : ""}` },
          { key: "required", header: "Required", render: (item) => <Badge tone={item.isRequired ? "warning" : "neutral"}>{item.isRequired ? "Required" : "Optional"}</Badge> },
          { key: "active", header: "Active", render: (item) => <Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "Active" : "Inactive"}</Badge> },
        ]}
      />
    </AdminShell>
  );
}

export const sellerTypeOptions = Object.values(SellerType).map((value) => ({ value, label: value.replace(/_/g, " ") }));
export const requirementTypeOptions = Object.values(SellerRequirementType).map((value) => ({ value, label: value.replace(/_/g, " ") }));
export const providerOptions = Object.values(VerificationProvider).map((value) => ({ value, label: value.replace(/_/g, " ") }));
