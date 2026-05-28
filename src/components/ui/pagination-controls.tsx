import Link from "next/link";
import { cn } from "@/lib/utils";
import { pageHref, type PaginationMeta, type SearchParamsRecord } from "@/lib/pagination";

export function PaginationControls({
  pagination,
  basePath,
  searchParams,
  itemLabel = "items",
  className,
  alwaysShow = false,
}: {
  pagination: PaginationMeta;
  basePath: string;
  searchParams?: SearchParamsRecord;
  itemLabel?: string;
  className?: string;
  alwaysShow?: boolean;
}) {
  if (!alwaysShow && pagination.totalPages <= 1) return null;

  const previousHref = pageHref(basePath, searchParams, pagination.page - 1);
  const nextHref = pageHref(basePath, searchParams, pagination.page + 1);

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className={cn(
        "flex flex-col gap-3 rounded-3xl border border-[var(--color-border)] bg-white px-5 py-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-[var(--color-muted)]">
        Showing <span className="font-semibold text-[var(--color-ink)]">{pagination.startItem}</span>
        {"-"}
        <span className="font-semibold text-[var(--color-ink)]">{pagination.endItem}</span> of{" "}
        <span className="font-semibold text-[var(--color-ink)]">{pagination.totalItems}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        {pagination.hasPreviousPage ? (
          <Link
            href={previousHref}
            className="rounded-2xl border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-2xl border border-slate-200 px-4 py-2 font-semibold text-slate-400">Previous</span>
        )}
        <span className="rounded-2xl bg-slate-100 px-4 py-2 font-semibold text-[var(--color-ink)]">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        {pagination.hasNextPage ? (
          <Link
            href={nextHref}
            className="rounded-2xl border border-[var(--color-border)] px-4 py-2 font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-2xl border border-slate-200 px-4 py-2 font-semibold text-slate-400">Next</span>
        )}
      </div>
    </nav>
  );
}
