import Link from "next/link";
import { SellerRequirementType, SellerType, VerificationProvider } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VerificationRequirementsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [session, params, requirements] = await Promise.all([
    requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]),
    searchParams,
    prisma.sellerVerificationRequirement.findMany({ orderBy: [{ sellerType: "asc" }, { countryCode: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return (
    <AdminShell session={session} title="Verification requirements" description="Configure country, region, and seller-type compliance requirements.">
      {params.message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{params.message}</div> : null}
      <div><Button asChild><Link href="/admin/verifications/requirements/new">New requirement</Link></Button></div>
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
