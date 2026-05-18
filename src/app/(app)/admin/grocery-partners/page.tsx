import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listAdminGroceryPartners } from "@/server/grocery-partners";
import { saveGroceryPartnerAction } from "./actions";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "disabled", label: "Disabled" },
];

const partnerStatusOptions = statusOptions.filter((option) => option.value);
const integrationOptions = [
  { value: "export_only", label: "Export only" },
  { value: "manual_link", label: "Manual link" },
  { value: "affiliate_link", label: "Affiliate link placeholder" },
  { value: "api_placeholder", label: "API placeholder" },
];

export default async function AdminGroceryPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string; message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const [partners, countries] = await Promise.all([
    listAdminGroceryPartners(session, params),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { countryName: "asc" } }),
  ]);

  return (
    <AdminShell session={session} title="Grocery partners" description="Manage country-specific grocery handoff placeholders. No checkout or payment is connected.">
      {params.message && <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card>}

      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Partners</p><p className="mt-3 text-3xl font-semibold">{partners.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active</p><p className="mt-3 text-3xl font-semibold">{partners.filter((p) => p.status === "active").length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Export-only</p><p className="mt-3 text-3xl font-semibold">{partners.filter((p) => p.integrationType === "export_only").length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Countries</p><p className="mt-3 text-3xl font-semibold">{new Set(partners.map((p) => p.countryCode)).size}</p></Card>
      </section>

      <Card>
        <form className="grid gap-4 md:grid-cols-3">
          <SelectInput
            label="Country"
            name="countryCode"
            defaultValue={params.countryCode ?? ""}
            options={[{ value: "", label: "All countries" }, ...countries.map((country) => ({ value: country.countryCode, label: `${country.countryName} (${country.countryCode})` }))]}
          />
          <SelectInput label="Status" name="status" defaultValue={params.status ?? ""} options={statusOptions} />
          <div className="flex items-end"><Button type="submit" className="w-full">Filter</Button></div>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Create grocery partner</h2>
        <form action={saveGroceryPartnerAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput label="Name" name="name" required />
          <SelectInput label="Country" name="countryCode" options={countries.map((country) => ({ value: country.countryCode, label: `${country.countryName} (${country.countryCode})` }))} />
          <TextInput label="Website URL" name="websiteUrl" placeholder="https://example.com" />
          <TextInput label="Logo URL" name="logoUrl" placeholder="https://example.com/logo.png" />
          <SelectInput label="Integration type" name="integrationType" defaultValue="export_only" options={integrationOptions} />
          <SelectInput label="Status" name="status" defaultValue="draft" options={partnerStatusOptions} />
          <TextArea label="Supported regions" name="supportedRegions" hint="Comma-separated or one per line." />
          <TextArea label="Notes" name="notes" />
          <div className="md:col-span-2"><Button type="submit">Create partner</Button></div>
        </form>
      </Card>

      <AdminDataTable
        data={partners}
        emptyMessage="No grocery partners found."
        columns={[
          {
            key: "name",
            header: "Partner",
            render: (partner) => (
              <div>
                <Link href={`/admin/grocery-partners/${partner.id}`} className="font-semibold text-[var(--color-primary)]">{partner.name}</Link>
                <p className="text-[var(--color-muted)]">{partner.countryCode} · {partner.integrationType.replace(/_/g, " ")}</p>
              </div>
            ),
          },
          { key: "status", header: "Status", render: (partner) => <Badge tone={partner.status === "active" ? "success" : "warning"}>{partner.status}</Badge> },
          { key: "website", header: "Website", render: (partner) => partner.websiteUrl ? <a href={partner.websiteUrl} target="_blank" rel="noreferrer" className="text-[var(--color-primary)]">Open</a> : "Not set" },
        ]}
      />
    </AdminShell>
  );
}
