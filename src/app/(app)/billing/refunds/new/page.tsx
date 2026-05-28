import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import { listRefundablePaymentOrders } from "@/server/payments/refund-requests";
import { requestBillingRefundAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewBillingRefundPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentOrderId?: string; message?: string }>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const orders = await listRefundablePaymentOrders(session);
  const selectedOrder = params.paymentOrderId
    ? orders.find((order) => order.id === params.paymentOrderId)
    : orders[0];

  if (params.paymentOrderId && !selectedOrder) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Request a refund"
        description="Choose the paid billing transaction you want reviewed. This creates a refund request for the billing team; it does not create a generic support ticket."
        actions={
          <Link href="/billing" className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50">
            Back to billing
          </Link>
        }
      />
      <FormMessage message={params.message} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Refund details</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Payment to review</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
              Refunds are reviewed against the selected payment, invoice, and payment gateway record. Approved refunds are processed by an authorized admin.
            </p>
          </div>

          {orders.length ? (
            <form action={requestBillingRefundAction} className="space-y-5">
              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                Paid payment
                <select
                  name="paymentOrderId"
                  defaultValue={selectedOrder?.id}
                  className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
                  required
                >
                  {orders.map((order) => {
                    const invoiceNumber = order.accountingDocuments[0]?.documentNumber;
                    return (
                      <option key={order.id} value={order.id}>
                        {invoiceNumber ? `${invoiceNumber} - ` : ""}
                        {formatMoney(order.currencyCode, Number(order.amount))} paid {order.paidAt ? formatDate(order.paidAt) : formatDate(order.createdAt)}
                      </option>
                    );
                  })}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                  Refund amount
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={selectedOrder?.remainingRefundAmount.toFixed(2)}
                    className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                    required
                  />
                  <span className="text-xs font-normal text-[var(--color-muted)]">
                    The server will verify the amount does not exceed the selected payment&apos;s refundable balance.
                  </span>
                </label>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Available to request</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-950">
                    {selectedOrder ? formatMoney(selectedOrder.currencyCode, selectedOrder.remainingRefundAmount) : "$0.00"}
                  </p>
                </div>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                Refund reason
                <textarea
                  name="reason"
                  rows={5}
                  placeholder="Tell us what happened and why you are requesting a refund."
                  className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  required
                />
              </label>

              <button className="rounded-2xl bg-[var(--button-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--button-primary-text)] shadow-sm hover:bg-[var(--button-primary-hover-bg)]">
                Submit refund request
              </button>
            </form>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-slate-50 p-8 text-sm text-[var(--color-muted)]">
              No paid refundable billing payments are available for this account yet.
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-50">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Review process</p>
            <h2 className="mt-2 text-lg font-semibold text-amber-950">What happens next?</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Your request is saved as a billing refund review. A platform owner or admin can approve, process, or decline it from the payment refunds area.
            </p>
          </Card>

          {selectedOrder ? (
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected payment</p>
              <div className="mt-4 space-y-3 text-sm">
                <DetailRow label="Invoice" value={selectedOrder.accountingDocuments[0]?.documentNumber ?? "Payment record"} />
                <DetailRow label="Provider" value={selectedOrder.provider} />
                <DetailRow label="Status" value={<Badge tone="success">{selectedOrder.status}</Badge>} />
                <DetailRow label="Paid amount" value={formatMoney(selectedOrder.currencyCode, Number(selectedOrder.amount))} />
                <DetailRow label="Refundable" value={formatMoney(selectedOrder.currencyCode, selectedOrder.remainingRefundAmount)} />
              </div>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--color-ink)]">{value}</span>
    </div>
  );
}

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}
