import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminSupportTicketsPage } from "@/server/support";
import type { SupportTicketPriority, SupportTicketStatus, SupportTicketType } from "@prisma/client";

export const dynamic = "force-dynamic";

const supportRoles = ["platform_owner", "platform_admin", "support_admin"] as const;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; priority?: string; page?: string }>;
}) {
  const session = await requirePlatformRole([...supportRoles]);
  const params = await searchParams;
  const tickets = await listAdminSupportTicketsPage(session, {
    type: params.type as SupportTicketType | undefined,
    status: params.status as SupportTicketStatus | undefined,
    priority: params.priority as SupportTicketPriority | undefined,
    page: params.page,
  });

  return (
    <AdminShell
      session={session}
      title="Support tickets"
      description="Review beta feedback, bug reports, and support requests without exposing internal notes to users."
    >
      <form className="grid gap-4 rounded-3xl border border-[var(--color-border)] bg-white p-4 md:grid-cols-4">
        <SelectInput
          label="Type"
          name="type"
          defaultValue={params.type ?? ""}
          options={[
            { value: "", label: "All types" },
            { value: "bug", label: "Bug" },
            { value: "feedback", label: "Feedback" },
            { value: "feature_request", label: "Feature request" },
            { value: "account_help", label: "Account help" },
            { value: "billing", label: "Billing" },
            { value: "other", label: "Other" },
          ]}
        />
        <SelectInput
          label="Status"
          name="status"
          defaultValue={params.status ?? ""}
          options={[
            { value: "", label: "All statuses" },
            { value: "open", label: "Open" },
            { value: "in_review", label: "In review" },
            { value: "waiting_on_user", label: "Waiting on user" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
          ]}
        />
        <SelectInput
          label="Priority"
          name="priority"
          defaultValue={params.priority ?? ""}
          options={[
            { value: "", label: "All priorities" },
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ]}
        />
        <div className="flex items-end">
          <Button type="submit" variant="secondary">Filter</Button>
        </div>
      </form>

      <AdminDataTable
        data={tickets.items}
        emptyMessage="No support tickets found."
        pagination={tickets.pagination}
        paginationBasePath="/admin/support"
        paginationSearchParams={params}
        paginationItemLabel="tickets"
        columns={[
          {
            key: "ticket",
            header: "Ticket",
            render: (ticket) => (
              <div>
                <Link href={`/admin/support/${ticket.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                  {ticket.title}
                </Link>
                <p className="text-[var(--color-muted)]">{ticket.createdBy?.email ?? "Unknown user"}</p>
              </div>
            ),
          },
          {
            key: "type",
            header: "Type",
            render: (ticket) => <Badge tone="info">{ticket.type.replace(/_/g, " ")}</Badge>,
          },
          {
            key: "status",
            header: "Status",
            render: (ticket) => <StatusBadge value={ticket.status} />,
          },
          {
            key: "priority",
            header: "Priority",
            render: (ticket) => <Badge tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"}>{ticket.priority}</Badge>,
          },
        ]}
      />
    </AdminShell>
  );
}
