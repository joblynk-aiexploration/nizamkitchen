"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/pricing", label: "Pricing" },
  { href: "/for-households", label: "For Households" },
  { href: "/for-chefs", label: "For Chefs" },
  { href: "/for-restaurants", label: "For Restaurants" },
  { href: "/about", label: "About" },
];

export function PublicNav({ dashboardHref }: { dashboardHref?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";
  const isAuthPage = isLogin || isRegister;
  const isSignedIn = Boolean(dashboardHref);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-white/95 text-[var(--text-primary)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-xs font-bold text-white shadow">
            NK
          </div>
          <span className="font-serif text-lg text-[var(--color-ink)]">NizamKitchen</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition focus-visible:ring-offset-white",
                pathname === link.href
                  ? "bg-[#e4f2f0] font-semibold text-[var(--color-primary-strong)]"
                  : "text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-2 lg:flex">
          {isSignedIn ? (
            <Link
              href={dashboardHref ?? "/dashboard"}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0b625c] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#084c47]"
            >
              Dashboard
            </Link>
          ) : isAuthPage ? null : (
            <>
              <Link
                href="/login"
                aria-current={isLogin ? "page" : undefined}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  isLogin
                    ? "bg-[#e4f2f0] text-[var(--color-primary-strong)]"
                    : "text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)]",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                aria-current={isRegister ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition",
                  isRegister
                    ? "border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200"
                    : "bg-[#0b625c] text-white hover:bg-[#084c47]",
                )}
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--button-outline-border)] bg-white text-[var(--text-primary)] transition hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-[var(--color-border)] bg-white px-5 pb-4 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  pathname === link.href
                    ? "bg-[#e4f2f0] font-semibold text-[var(--color-primary-strong)]"
                    : "text-[var(--text-primary)] hover:bg-slate-100",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
            {isSignedIn ? (
              <Link
                href={dashboardHref ?? "/dashboard"}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0b625c] px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#084c47]"
              >
                Dashboard
              </Link>
            ) : isAuthPage ? null : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  aria-current={isLogin ? "page" : undefined}
                  className={cn(
                    "rounded-xl border border-[var(--button-outline-border)] px-4 py-2 text-center text-sm font-semibold",
                    isLogin
                      ? "bg-[#e4f2f0] text-[var(--color-primary-strong)]"
                      : "bg-white text-[var(--text-primary)] hover:bg-slate-100",
                  )}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  aria-current={isRegister ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-center text-sm font-semibold shadow-sm transition",
                    isRegister
                      ? "border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200"
                      : "bg-[#0b625c] text-white hover:bg-[#084c47]",
                  )}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
