"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Menu, X } from "lucide-react";

const DESKTOP_QUERY = "(min-width: 1024px)"; // matches Tailwind `lg`

function subscribeToDesktop(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Responsive chrome for the authenticated app shell.
 *
 * - At `lg` and above: unchanged two-column grid (sidebar is static, sticky, always visible).
 * - Below `lg`: the sidebar becomes an off-canvas drawer opened by a hamburger in a sticky top bar.
 *
 * Accessibility:
 * - Hamburger exposes aria-expanded / aria-controls.
 * - Drawer is a labelled dialog; Escape closes it.
 * - Focus moves into the drawer on open and returns to the trigger on close.
 * - Focus is trapped inside the drawer while open.
 * - Background scroll is locked while open.
 * - Drawer closes when any navigation link inside it is activated.
 * - Dialog semantics are applied only below `lg`, so desktop screen-reader users
 *   always see the sidebar as ordinary in-page navigation.
 */
export function AppShellChrome({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Derived from matchMedia rather than an effect, so drawer semantics are never
  // applied at desktop widths where the sidebar is permanently visible.
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  const drawerOpen = open && !isDesktop;
  const drawerRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Close the drawer when a navigation link inside it is activated. Handled as an
  // event rather than a route-change effect so we never setState during render sync.
  const handleDrawerClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a[href]")) {
      setOpen(false);
    }
  };

  // Escape to close.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  // Move focus into the drawer on open; restore it to the trigger on close.
  useEffect(() => {
    if (isDesktop) return;
    if (drawerOpen) {
      closeRef.current?.focus();
      return;
    }
    triggerRef.current?.focus({ preventScroll: true });
  }, [drawerOpen, isDesktop]);

  // Trap focus inside the drawer while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Mobile top bar — hidden from lg upwards */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[var(--color-sidebar)] px-4 py-3 text-[var(--color-sidebar-text)] lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="font-serif text-lg font-semibold text-white">NizamKitchen</span>
      </header>

      {/* Scrim */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: off-canvas drawer below lg, static column from lg up */}
      <aside
        id="app-sidebar"
        ref={drawerRef}
        onClick={handleDrawerClick}
        role={isDesktop ? undefined : "dialog"}
        aria-modal={drawerOpen ? true : undefined}
        aria-label="Main navigation"
        aria-hidden={!isDesktop && !open ? true : undefined}
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col overflow-y-auto",
          "bg-[linear-gradient(180deg,var(--color-sidebar)_0%,var(--color-sidebar-strong)_100%)]",
          "px-6 py-8 text-[var(--color-sidebar-text)] shadow-2xl",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          // Guarded with an lg: override so the desktop sidebar is never inert,
          // including during the pre-hydration pass where isDesktop is still false.
          !isDesktop && !open ? "pointer-events-none lg:pointer-events-auto" : "",
          // From lg up: always visible, in-flow, sticky, full height, no transform.
          "lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0",
          "lg:overflow-hidden lg:shadow-none",
        ].join(" ")}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation menu"
          className="mb-4 inline-flex h-10 w-10 items-center justify-center self-end rounded-xl bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {sidebar}
      </aside>

      <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
