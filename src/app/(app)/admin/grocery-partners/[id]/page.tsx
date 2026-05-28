import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAdminGroceryPartner } from "@/server/grocery-partners";
import { saveGroceryPartnerAction } from "../actions";

export const dynamic = "force-dynamic";

const integrationOptions = [
  { value: "export_only", label: "Export only" },
  { value: "manual_link", label: "Manual link" },
  { value: "affiliate_link", label: "Affiliate link placeholder" },
  { value: "api_placeholder", label: "API placeholder" },
];

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "disabled", label: "Disabled" },
];

export default async function AdminGroceryPartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const query = await searchParams;
  let partner;
  try {
    partner = await getAdminGroceryPartner(session, id);
  } catch {
    notFound();
  }
  const countries = await prisma.country.findMany({ where: { isActive: true }, orderBy: { countryName: "asc" } });
  const supportedRegions = Array.isArray(partner.supportedRegions) ? partner.supportedRegions.join("\n") : "";

  return (
    <AdminShell session={session} title={partner.name} description="Edit grocery partner metadata and availability state.">
      {query.message && <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card>}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={partner.status === "active" ? "success" : "warning"}>{partner.status}</Badge>
          <Badge tone="info">{partner.integrationType.replace(/_/g, " ")}</Badge>
          <Link href="/admin/grocery-partners" className="ml-auto text-sm text-[var(--color-primary)]">Back to partners</Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Partner settings</h2>
        <form action={saveGroceryPartnerAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="partnerId" value={partner.id} />
          <TextInput label="Name" name="name" defaultValue={partner.name} required />
          <SelectInput
            label="Country"
            name="countryCode"
            defaultValue={partner.countryCode}
            options={countries.map((country) => ({ value: country.countryCode, label: `${country.countryName} (${country.countryCode})` }))}
          />
          <TextInput label="Website URL" name="websiteUrl" defaultValue={partner.websiteUrl ?? ""} />
          <TextInput label="Logo URL" name="logoUrl" defaultValue={partner.logoUrl ?? ""} />
          <SelectInput label="Integration type" name="integrationType" defaultValue={partner.integrationType} options={integrationOptions} />
          <SelectInput label="Status" name="status" defaultValue={partner.status} options={statusOptions} />
          <TextArea label="Supported regions" name="supportedRegions" defaultValue={supportedRegions} />
          <TextArea label="Notes" name="notes" defaultValue={partner.notes ?? ""} />
          <div className="md:col-span-2"><Button type="submit">Save partner</Button></div>
        </form>
      </Card>
    </AdminShell>
  );
}
