import Link from "next/link";
import { LogIn } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-500">
        <LogIn className="h-10 w-10" />
      </div>
      <h1 className="mt-6 font-serif text-3xl text-[var(--color-ink)]">Sign in required</h1>
      <p className="mt-3 max-w-md text-[var(--color-muted)]">
        You need to be signed in to access this page.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/"
          className="rounded-2xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
