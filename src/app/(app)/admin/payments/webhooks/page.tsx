import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPaymentWebhookEvents } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

export default async function PaymentWebhooksPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const events = await listPaymentWebhookEvents(session);
  return (
    <AdminShell session={session} title="Payment webhooks" description="Webhook events are stored idempotently by provider event ID before processing. Secrets are never logged here.">
      <AdminDataTable
        data={events}
        emptyMessage="No webhook events yet."
        columns={[
          { key: "provider", header: "Provider", render: (event) => event.provider },
          { key: "event", header: "Event", render: (event) => <div><p className="font-semibold">{event.eventType}</p><p className="text-[var(--color-muted)]">{event.eventId}</p></div> },
          { key: "status", header: "Status", render: (event) => <Badge tone={event.status === "processed" ? "success" : event.status === "failed" ? "danger" : "warning"}>{event.status}</Badge> },
          { key: "signature", header: "Signature", render: (event) => <Badge tone={event.signatureValid ? "success" : "warning"}>{event.signatureValid ? "valid" : "not verified"}</Badge> },
          { key: "created", header: "Created", render: (event) => event.createdAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
