import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminFilterBar({
  children,
  searchPlaceholder = "Search",
  showSearch = true,
}: {
  children?: React.ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
}) {
  return (
    <form className="rounded-3xl border border-[var(--color-border)] bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {showSearch ? (
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="search"
                placeholder={searchPlaceholder}
                className="w-full rounded-2xl border border-[var(--color-border)] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
              />
            </label>
          ) : null}
          {children}
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </div>
      </div>
    </form>
  );
}
