import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "@/components/accounting/invoice-actions";
import {
  NIZAMKITCHEN_BILLING_BRAND,
  amountPaid,
  balanceDue,
  buildInvoiceLines,
  formatInvoiceDate,
  formatInvoiceMoney,
  invoiceStatusLabel,
  invoiceTitle,
  providerLabel,
  sourceLabel,
  type InvoiceBrandingSettings,
  type InvoiceDocument,
} from "@/server/accounting/invoice-document";

type Props = {
  document: InvoiceDocument;
  branding?: InvoiceBrandingSettings;
  backHref: string;
  pdfHref: string;
};

export function BrandedInvoiceDocument({ document, branding = NIZAMKITCHEN_BILLING_BRAND, backHref, pdfHref }: Props) {
  const lines = buildInvoiceLines(document);
  const title = invoiceTitle(document);
  const paidAmount = amountPaid(document);
  const dueAmount = balanceDue(document);
  const paymentStatus = invoiceStatusLabel(document.paymentOrder.status);
  const documentStatus = invoiceStatusLabel(document.status);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .invoice-print-scope, .invoice-print-scope * { visibility: visible; }
          .invoice-print-scope { position: absolute; inset: 0; width: 100%; background: white; }
          .invoice-no-print { display: none !important; }
        }
      `}</style>

      <div className="invoice-no-print flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="secondary">
          <Link href={backHref}>Back to invoices</Link>
        </Button>
        <div className="flex flex-wrap gap-3">
          <InvoicePrintButton />
          <Button asChild>
            <a href={pdfHref}>Download PDF</a>
          </Button>
        </div>
      </div>

      <article className="invoice-print-scope overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
        <header className="bg-[linear-gradient(135deg,#082f49,#0f766e)] px-8 py-8 text-white md:px-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-black ring-1 ring-white/30">
                NK
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">{branding.name}</p>
                <h1 className="mt-2 font-serif text-4xl text-white">{title}</h1>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-4 text-sm ring-1 ring-white/20">
              <p className="text-emerald-100">Document number</p>
              <p className="mt-1 text-lg font-bold">{document.documentNumber}</p>
              <p className="mt-3 text-emerald-100">Status</p>
              <p className="mt-1 inline-flex rounded-full bg-white/15 px-3 py-1 font-semibold">{documentStatus}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 border-b border-slate-200 px-8 py-8 md:grid-cols-3 md:px-12">
          <InfoBlock
            title="From"
            lines={[
              branding.legalName,
              ...branding.addressLines,
              branding.email,
              branding.phone,
              branding.website,
              branding.taxId ? `Tax ID: ${branding.taxId}` : null,
            ]}
          />
          <InfoBlock
            title="Bill to"
            lines={[
              document.customerOrganizationName ?? document.organization.name,
              `Country: ${document.countryCode}`,
              `Client ID: ${document.customerOrganizationId ?? document.organizationId}`,
              ...(document.sellerOrganizationName ? [`Seller: ${document.sellerOrganizationName}`] : []),
            ]}
          />
          <InfoBlock
            title="Document dates"
            lines={[
              `Issued: ${formatInvoiceDate(document.issuedAt)}`,
              `Due: ${document.dueAt ? formatInvoiceDate(document.dueAt) : "Due on receipt"}`,
              `Paid: ${document.paymentOrder.paidAt ? formatInvoiceDate(document.paymentOrder.paidAt) : "Not paid"}`,
              `Payment: ${paymentStatus}`,
            ]}
          />
        </section>

        <section className="px-8 py-8 md:px-12">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Service details</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">{sourceLabel(document.paymentOrder.module)}</h2>
              <p className="text-sm text-slate-500">Reference: {document.paymentOrder.moduleEntityId}</p>
            </div>
            {branding.showProviderRow ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Provider: <span className="font-semibold text-slate-950">{providerLabel(document.paymentOrder.provider)}</span>
              </div>
            ) : null}
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <PaymentSummaryCard label="Amount paid" value={formatInvoiceMoney(document.currencyCode, paidAmount)} tone="success" />
            <PaymentSummaryCard label="Balance due" value={formatInvoiceMoney(document.currencyCode, dueAmount)} tone={dueAmount > 0 ? "danger" : "success"} />
            <PaymentSummaryCard label="Payment status" value={paymentStatus} tone={document.paymentOrder.status === "paid" ? "success" : "neutral"} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className="col-span-4">Description</span>
              <span className="col-span-1 text-right">Qty</span>
              <span className="col-span-2 text-right">Unit</span>
              <span className="col-span-2 text-right">Tax/Fee</span>
              <span className="col-span-1 text-right">Discount</span>
              <span className="col-span-2 text-right">Line total</span>
            </div>
            {lines.map((line) => (
              <div key={`${line.description}-${line.amount}`} className="grid grid-cols-12 gap-3 border-t border-slate-200 px-4 py-4 text-sm">
                <div className="col-span-4">
                  <p className="font-semibold text-slate-950">{line.description}</p>
                  <p className="mt-1 text-slate-500">{line.details}</p>
                </div>
                <span className="col-span-1 text-right text-slate-700">{line.quantity}</span>
                <span className="col-span-2 text-right text-slate-700">{formatInvoiceMoney(document.currencyCode, line.unitPrice)}</span>
                <span className="col-span-2 text-right text-slate-700">{formatInvoiceMoney(document.currencyCode, line.taxFee)}</span>
                <span className="col-span-1 text-right text-slate-700">{formatInvoiceMoney(document.currencyCode, line.discount)}</span>
                <span className="col-span-2 text-right font-semibold text-slate-950">{formatInvoiceMoney(document.currencyCode, line.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 bg-slate-50 px-8 py-8 md:grid-cols-[1fr_360px] md:px-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            <p className="font-semibold text-slate-950">Notes and terms</p>
            <p className="mt-2">{branding.defaultNotes}</p>
            <p className="mt-3">{branding.paymentTerms}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <SummaryRow label="Subtotal" value={formatInvoiceMoney(document.currencyCode, document.subtotalAmount)} />
            {(branding.showZeroDiscountRow || Number(document.paymentOrder.discountAmount ?? 0) > 0) ? (
              <SummaryRow label="Discounts" value={formatInvoiceMoney(document.currencyCode, document.paymentOrder.discountAmount ?? 0)} />
            ) : null}
            <SummaryRow label="Taxes / fees" value={formatInvoiceMoney(document.currencyCode, document.taxAmount)} />
            <SummaryRow label="Platform fee" value={formatInvoiceMoney(document.currencyCode, document.platformFeeAmount ?? 0)} />
            <SummaryRow label="Amount paid" value={formatInvoiceMoney(document.currencyCode, paidAmount)} />
            <SummaryRow label="Balance due" value={formatInvoiceMoney(document.currencyCode, dueAmount)} />
            <div className="mt-4 border-t border-slate-200 pt-4">
              <SummaryRow label="Total" value={formatInvoiceMoney(document.currencyCode, document.totalAmount)} strong />
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-8 py-5 text-sm text-slate-500 md:px-12">
          <span>{branding.footerText}</span>
          <span>{branding.website}</span>
        </footer>
      </article>
    </div>
  );
}

function InfoBlock({ title, lines }: { title: string; lines: Array<string | null | undefined> }) {
  const visibleLines = lines.filter((line): line is string => Boolean(line));
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">{title}</p>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        {visibleLines.map((line) => <p key={line}>{line}</p>)}
      </div>
    </div>
  );
}

function PaymentSummaryCard({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "neutral" }) {
  const toneClass = tone === "success" ? "text-teal-700" : tone === "danger" ? "text-rose-700" : "text-slate-950";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className={strong ? "text-base font-bold text-slate-950" : "text-sm text-slate-600"}>{label}</span>
      <span className={strong ? "text-xl font-black text-slate-950" : "text-sm font-semibold text-slate-950"}>{value}</span>
    </div>
  );
}
