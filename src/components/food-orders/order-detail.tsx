import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { FoodOrderDetail } from "@/server/food-orders";

function formatMoney(currencyCode: string, amount: unknown) {
  if (amount == null) return "To be confirmed";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "To be confirmed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

export function FoodOrderSummary({ order, showInternal = false }: { order: FoodOrderDetail; showInternal?: boolean }) {
  const hasPayableAmount = order.subtotalAmount != null && Number(order.subtotalAmount) > 0;

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
        <div className={["mt-5 rounded-2xl border p-4 text-sm leading-6", hasPayableAmount ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"].join(" ")}>
          {hasPayableAmount ? (
            <>
              <span className="font-semibold">Online checkout is available for this order.</span>{" "}
              Use the checkout section on this page to pay securely with a hosted provider. NizamKitchen never stores card numbers or CVV.
            </>
          ) : (
            <>
              <span className="font-semibold">Online checkout is not available yet.</span>{" "}
              This order does not have a payable menu price, so the seller must confirm pricing before payment can be collected.
            </>
          )}
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
          <Info label="Fulfillment status" value={order.fulfillmentStatus.replace(/_/g, " ")} />
          <Info label="Requested date" value={order.requestedDate ? order.requestedDate.toLocaleDateString() : "Not specified"} />
          <Info label="Time window" value={order.requestedTimeWindow || "Not specified"} />
          <Info label="Pickup location" value={order.pickupAddressSnapshot || order.pickupLocation?.label || "Not assigned"} />
          <Info label="Delivery zone" value={order.deliveryZone?.name || "Not matched"} />
          <Info label="Delivery fee" value={order.deliveryFeeAmount != null ? formatMoney(order.currencyCode, order.deliveryFeeAmount) : "Not applied"} />
          <Info label="Estimated subtotal" value={formatMoney(order.currencyCode, order.subtotalAmount)} />
          <Info label="Payment status" value={order.paymentStatus.replace(/_/g, " ")} />
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
        {order.fulfillmentEvents.length > 0 ? (
          <>
            <h3 className="mt-6 font-semibold text-[var(--color-ink)]">Fulfillment tracking</h3>
            <div className="mt-4 space-y-4">
              {order.fulfillmentEvents.map((event) => (
                <div key={event.id} className="border-l-2 border-emerald-500 pl-4">
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{event.eventType.replace(/_/g, " ")}</p>
                  <p className="text-xs text-[var(--color-muted)]">{event.createdAt.toLocaleString()}</p>
                  {event.note ? <p className="mt-1 text-sm text-[var(--color-muted)]">{event.note}</p> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
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
