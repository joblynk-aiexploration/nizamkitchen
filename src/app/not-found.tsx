import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[linear-gradient(145deg,#f7f9fb_0%,#ebf5f5_100%)] px-5">
      <div className="max-w-md text-center">
        <p className="font-serif text-8xl font-bold text-[var(--color-primary)] opacity-20">404</p>
        <h1 className="mt-2 font-serif text-3xl text-[var(--color-ink)]">Page not found</h1>
        <p className="mt-4 text-[var(--color-muted)]">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
