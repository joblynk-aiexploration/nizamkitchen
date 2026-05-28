import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-500">
        <ShieldX className="h-10 w-10" />
      </div>
      <h1 className="mt-6 font-serif text-3xl text-[var(--color-ink)]">Access denied</h1>
      <p className="mt-3 max-w-md text-[var(--color-muted)]">
        You don&apos;t have permission to view this page. If you believe this is a mistake,
        contact your organization owner or platform administrator.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Back to dashboard
        </Link>
        <Link
          href="/contact"
          className="rounded-2xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
