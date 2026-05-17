import { DataTable } from "@/components/ui/data-table";

type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
};

export function AdminDataTable<T>({
  columns,
  data,
  emptyMessage,
}: {
  columns: Column<T>[];
  data: T[];
  emptyMessage: string;
}) {
  return <DataTable columns={columns} data={data} emptyMessage={emptyMessage} />;
}
