import { DataTable } from "@/components/ui/data-table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { PaginationMeta, SearchParamsRecord } from "@/lib/pagination";

type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  width?: string;
};

export function AdminDataTable<T>({
  columns,
  data,
  emptyMessage,
  pagination,
  paginationBasePath,
  paginationSearchParams,
  paginationItemLabel,
}: {
  columns: Column<T>[];
  data: T[];
  emptyMessage: string;
  pagination?: PaginationMeta;
  paginationBasePath?: string;
  paginationSearchParams?: SearchParamsRecord;
  paginationItemLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <DataTable columns={columns} data={data} emptyMessage={emptyMessage} />
      {pagination && paginationBasePath ? (
        <PaginationControls
          pagination={pagination}
          basePath={paginationBasePath}
          searchParams={paginationSearchParams}
          itemLabel={paginationItemLabel}
        />
      ) : null}
    </div>
  );
}
