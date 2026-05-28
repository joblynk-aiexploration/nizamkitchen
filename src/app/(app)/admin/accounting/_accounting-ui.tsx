import Link from "next/link";
import { Card } from "@/components/ui/card";

export function Money({ currencyCode, amount }: { currencyCode: string; amount: unknown }) {
  return <span>{currencyCode} {String(amount ?? "0")}</span>;
}

export function AccountingTabs() {
  const links = [
    ["/admin/accounting", "Overview"],
    ["/admin/accounting/taxes", "Taxes"],
    ["/admin/accounting/invoices", "Invoices"],
    ["/admin/accounting/receipts", "Receipts"],
    ["/admin/accounting/commissions", "Commissions"],
    ["/admin/accounting/settlements", "Settlements"],
    ["/admin/accounting/exports", "Exports"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-slate-50">
          {label}
        </Link>
      ))}
    </div>
  );
}

export function Metric({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      {detail ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{detail}</p> : null}
    </Card>
  );
}

export function Message({ message }: { message?: string }) {
  if (!message) return null;
  const error = /unable|error|required/i.test(message);
  return (
    <Card className={error ? "border-rose-200 bg-rose-50 text-sm text-rose-800" : "border-emerald-200 bg-emerald-50 text-sm text-emerald-800"}>
      {message}
    </Card>
  );
}
