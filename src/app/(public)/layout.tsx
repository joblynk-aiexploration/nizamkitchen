import Link from "next/link";
import { PublicNav } from "@/components/public/public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[var(--color-border)] bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-xs font-bold text-white shadow">
                  NK
                </div>
                <span className="font-serif text-lg text-[var(--color-ink)]">NizamKitchen</span>
              </div>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Plan, cook, hire, or order — built around authentic Hyderabadi food.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Product</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/features" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">Features</Link></li>
                <li><Link href="/pricing" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">Pricing</Link></li>
                <li><Link href="/for-households" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">For Households</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Partners</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/for-chefs" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">For Chefs</Link></li>
                <li><Link href="/for-restaurants" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">For Restaurants</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Company</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/about" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">About</Link></li>
                <li><Link href="/contact" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">Contact</Link></li>
                <li><Link href="/legal/terms" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">Terms</Link></li>
                <li><Link href="/legal/privacy" className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-[var(--color-border)] pt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} NizamKitchen. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
