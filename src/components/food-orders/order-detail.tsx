import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { FoodOrderDetail } from "@/server/food-orders";

export function FoodOrderSummary({ order, showInternal = false }: { order: FoodOrderDetail; showInternal?: boolean }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Seller</p>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">{order.sellerOrganization.name}</h2>
          </div>
          <Badge tone={statusTone(order.status)}>{order.status.replace(/_/g, " ")}</Badge>
        </div>
        <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          Payment is handled directly with the seller for now. There is no checkout or payment collection in NizamKitchen.
        </div>
        <div className="mt-6 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{item.nameSnapshot}</p>
                {item.notes ? <p className="mt-1 text-sm text-[var(--color-muted)]">{item.notes}</p> : null}
              </div>
              <p className="text-sm font-semibold">x{item.quantity}</p>
            </div>
          ))}
        </div>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          <Info label="Fulfillment" value={order.fulfillmentType.replace(/_/g, " ")} />
          <Info label="Requested date" value={order.requestedDate ? order.requestedDate.toLocaleDateString() : "Not specified"} />
          <Info label="Time window" value={order.requestedTimeWindow || "Not specified"} />
          <Info label="Estimated subtotal" value={order.subtotalAmount ? `${order.currencyCode} ${order.subtotalAmount}` : "To be confirmed"} />
        </dl>
        {order.customerNotes ? <p className="mt-5 text-sm text-[var(--color-muted)]"><span className="font-semibold text-[var(--color-ink)]">Customer notes:</span> {order.customerNotes}</p> : null}
        {order.sellerNotes ? <p className="mt-3 text-sm text-[var(--color-muted)]"><span className="font-semibold text-[var(--color-ink)]">Seller notes:</span> {order.sellerNotes}</p> : null}
        {showInternal && order.adminNotes ? <p className="mt-3 text-sm text-[var(--color-muted)]"><span className="font-semibold text-[var(--color-ink)]">Admin notes:</span> {order.adminNotes}</p> : null}
      </Card>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Status timeline</h2>
        <div className="mt-5 space-y-4">
          {order.statusHistory.map((event) => (
            <div key={event.id} className="border-l-2 border-[var(--color-primary)] pl-4">
              <p className="text-sm font-semibold text-[var(--color-ink)]">{event.newStatus.replace(/_/g, " ")}</p>
              <p className="text-xs text-[var(--color-muted)]">{event.createdAt.toLocaleString()}</p>
              {event.note ? <p className="mt-1 text-sm text-[var(--color-muted)]">{event.note}</p> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function FoodOrderMessages({ order, showInternal = false }: { order: FoodOrderDetail; showInternal?: boolean }) {
  const messages = showInternal ? order.messages : order.messages.filter((message) => !message.isInternal);
  return (
    <Card>
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Messages</h2>
      {messages.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">No messages yet.</p> : null}
      <div className="mt-5 space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-[var(--color-ink)]">{message.sender.fullName}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{message.message}</p>
            <p className="mt-2 text-xs text-[var(--color-muted)]">{message.createdAt.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "completed" || status === "accepted") return "success";
  if (status === "declined" || status === "cancelled") return "danger";
  if (status === "ready_for_pickup" || status === "out_for_delivery") return "warning";
  return "info";
}
