import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
};

export function DataTable<T>({
  columns,
  data,
  emptyMessage,
}: {
  columns: Column<T>[];
  data: T[];
  emptyMessage: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--color-border)]">
      <div
        className="hidden border-b border-[var(--color-border)] bg-slate-50 px-6 py-3 md:grid"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
          >
            {column.header}
          </div>
        ))}
      </div>
      {data.length === 0 ? (
        <div className="px-6 py-10 text-sm text-[var(--color-muted)]">{emptyMessage}</div>
      ) : (
        data.map((item, index) => (
          <div
            key={index}
            className={cn(
              "table-grid border-t border-[var(--color-border)] bg-white px-6 py-5 md:border-t-0",
              index % 2 === 1 && "bg-[var(--color-card-alt)]",
            )}
            style={{ ["--columns" as string]: columns.length }}
          >
            {columns.map((column) => (
              <div key={column.key} className="text-sm text-[var(--color-ink)]">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 md:hidden">
                  {column.header}
                </div>
                {column.render(item)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
