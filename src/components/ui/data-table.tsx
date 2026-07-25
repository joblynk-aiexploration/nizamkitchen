import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  width?: string;
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
    <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)]">
      <div
        className="hidden border-b border-[var(--color-border)] bg-slate-50 px-6 py-3 md:grid"
        style={{ gridTemplateColumns: columns.map((column) => column.width ?? "minmax(0, 1fr)").join(" ") }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn("text-xs font-semibold uppercase tracking-[0.18em] text-slate-500", column.className)}
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
            style={{
              ["--columns" as string]: columns.length,
              ["--table-grid-template" as string]: columns.map((column) => column.width ?? "minmax(0, 1fr)").join(" "),
            }}
          >
            {columns.map((column) => (
              <div key={column.key} className={cn("text-sm text-[var(--color-ink)]", column.className)}>
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
