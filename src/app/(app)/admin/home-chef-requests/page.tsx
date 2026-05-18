import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminHomeChefRequests } from "@/server/home-chef";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewing", label: "Reviewing" },
  { value: "matched", label: "Matched" },
  { value: "quoted", label: "Quoted" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

export default async function AdminHomeChefRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string; date?: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const params = await searchParams;
  const [requests, countries] = await Promise.all([
    listAdminHomeChefRequests(session, params),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { countryName: "asc" } }),
  ]);

  const activeCount = requests.filter((request) => !["cancelled", "completed", "declined"].includes(request.status)).length;

  return (
    <AdminShell
      session={session}
      title="Home chef requests"
      description="Manual request operations for the home-chef MVP. This is support-led matching, not a marketplace."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Visible requests</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{requests.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Open requests</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Matched</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">
            {requests.filter((request) => request.assignedChefOrganizationId).length}
          </p>
        </Card>
      </section>

      <Card>
        <form className="grid gap-4 md:grid-cols-4">
          <SelectInput
            label="Country"
            name="countryCode"
            defaultValue={params.countryCode ?? ""}
            options={[
              { value: "", label: "All countries" },
              ...countries.map((country) => ({
                value: country.countryCode,
                label: `${country.countryName} (${country.countryCode})`,
              })),
            ]}
          />
          <SelectInput label="Status" name="status" defaultValue={params.status ?? ""} options={statusOptions} />
          <TextInput label="Requested date" name="date" type="date" defaultValue={params.date ?? ""} />
          <div className="flex items-end">
            <Button type="submit" className="w-full">Filter</Button>
          </div>
        </form>
      </Card>

      <AdminDataTable
        data={requests}
        emptyMessage="No home chef requests found."
        columns={[
          {
            key: "request",
            header: "Request",
            render: (request) => (
              <div>
                <Link href={`/admin/home-chef-requests/${request.id}`} className="font-semibold text-[var(--color-primary)]">
                  {request.title}
                </Link>
                <p className="mt-1 text-[var(--color-muted)]">
                  {request.organization.name} · {request.requestType.replace(/_/g, " ")}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (request) => <Badge tone={request.status === "submitted" ? "warning" : "neutral"}>{request.status}</Badge>,
          },
          {
            key: "date",
            header: "Requested",
            render: (request) => request.requestedDate.toLocaleDateString(),
          },
          {
            key: "country",
            header: "Country",
            render: (request) => request.countryCode,
          },
          {
            key: "chef",
            header: "Chef",
            render: (request) => request.assignedChefOrganization?.name ?? "Unassigned",
          },
        ]}
      />
    </AdminShell>
  );
}
