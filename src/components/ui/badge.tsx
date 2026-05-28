import { cn, titleCase } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "neutral" && "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
        tone === "success" && "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200",
        tone === "warning" && "bg-amber-100 text-amber-950 ring-1 ring-amber-200",
        tone === "danger" && "bg-rose-100 text-rose-950 ring-1 ring-rose-200",
        tone === "info" && "bg-blue-100 text-blue-950 ring-1 ring-blue-200",
      )}
    >
      {typeof children === "string" ? titleCase(children) : children}
    </span>
  );
}
