import { Search } from "lucide-react";

export function UserSearchBox({
  defaultValue = "",
  placeholder = "Search users",
}: {
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        name="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--color-border)] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
      />
    </label>
  );
}
