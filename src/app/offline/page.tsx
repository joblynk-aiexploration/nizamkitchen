import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="max-w-lg rounded-3xl border border-[var(--color-border)] bg-white p-8 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Offline</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-[var(--color-ink)]">NizamKitchen is waiting for a connection</h1>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Previously loaded pages may still be available, but live recipes, grocery updates, and support messages need the network.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white"
        >
          Try dashboard again
        </Link>
      </section>
    </main>
  );
}
