import Link from "next/link";
import { ToggleLeft } from "lucide-react";

export default function FeatureDisabledPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
        <ToggleLeft className="h-10 w-10" />
      </div>
      <h1 className="mt-6 font-serif text-3xl text-[var(--color-ink)]">Feature not available</h1>
      <p className="mt-3 max-w-md text-[var(--color-muted)]">
        This feature is not enabled for your account or region yet.
        It may be rolling out soon — check back later or contact support.
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
