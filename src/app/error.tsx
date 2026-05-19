"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[linear-gradient(145deg,#f7f9fb_0%,#ebf5f5_100%)] px-5">
      <div className="max-w-md text-center">
        <p className="font-serif text-8xl font-bold text-red-400 opacity-20">500</p>
        <h1 className="mt-2 font-serif text-3xl text-[var(--color-ink)]">Something went wrong</h1>
        <p className="mt-4 text-[var(--color-muted)]">
          An unexpected error occurred. This has been noted and we&apos;ll look into it.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-slate-400">Ref: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-2xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
