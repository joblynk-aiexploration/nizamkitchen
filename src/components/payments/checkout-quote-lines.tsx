export type CheckoutQuoteDisplayLine = {
  id?: string;
  lineType: string;
  label: string;
  description?: string | null;
  amount: unknown;
  currencyCode: string;
  sortOrder?: number;
  metadataJson?: unknown;
  metadata?: Record<string, unknown> | null;
};

type Props = {
  title?: string;
  description?: string;
  currencyCode: string;
  lines: CheckoutQuoteDisplayLine[];
  compact?: boolean;
};

export function CheckoutQuoteLines({
  title = "Checkout total",
  description = "Server-calculated pricing is verified again before hosted checkout opens.",
  currencyCode,
  lines,
  compact = false,
}: Props) {
  const visibleLines = customerVisibleQuoteLines(lines);
  const totalLine = visibleLines.find((line) => line.lineType === "total");
  const detailLines = visibleLines.filter((line) => line.lineType !== "total");

  if (visibleLines.length === 0) return null;

  return (
    <section className={compact ? "space-y-3 rounded-2xl border border-white/70 bg-white/70 p-4" : "space-y-4 rounded-3xl border border-[var(--color-border)] bg-white p-5"}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{title}</p>
        {description ? <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{description}</p> : null}
      </div>
      <div className="space-y-2">
        {detailLines.map((line) => (
          <QuoteLineRow key={line.id ?? `${line.label}-${line.sortOrder ?? line.amount}`} line={line} currencyCode={currencyCode} />
        ))}
      </div>
      {totalLine ? (
        <div className="border-t border-[var(--color-border)] pt-3">
          <QuoteLineRow line={totalLine} currencyCode={currencyCode} total />
        </div>
      ) : null}
    </section>
  );
}

export function customerVisibleQuoteLines(lines: CheckoutQuoteDisplayLine[]) {
  return [...lines]
    .filter((line) => !isInternalQuoteLine(line))
    .filter((line) => line.lineType === "total" || Number(line.amount ?? 0) !== 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function QuoteLineRow({
  line,
  currencyCode,
  total = false,
}: {
  line: CheckoutQuoteDisplayLine;
  currencyCode: string;
  total?: boolean;
}) {
  const amount = Number(line.amount ?? 0);
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <div>
        <p className={total ? "font-bold text-[var(--color-ink)]" : "text-sm font-semibold text-[var(--color-ink)]"}>{line.label}</p>
        {line.description ? <p className="mt-1 text-xs text-[var(--color-muted)]">{line.description}</p> : null}
      </div>
      <p className={total ? "text-lg font-black text-[var(--color-ink)]" : "text-sm font-semibold text-[var(--color-ink)]"}>
        {formatCheckoutMoney(currencyCode, amount)}
      </p>
    </div>
  );
}

function isInternalQuoteLine(line: CheckoutQuoteDisplayLine) {
  const metadata = metadataObject(line);
  return metadata?.internal === true || line.lineType === "commission" || line.lineType === "payout";
}

function metadataObject(line: CheckoutQuoteDisplayLine) {
  const value = line.metadata ?? line.metadataJson;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function formatCheckoutMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}
