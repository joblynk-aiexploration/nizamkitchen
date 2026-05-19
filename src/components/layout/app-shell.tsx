import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, MessageSquarePlus, Sparkles } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { LogoMark } from "@/components/layout/logo-mark";
import { LogoutForm } from "@/components/layout/logout-form";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { getUnreadNotificationCount } from "@/server/notifications/notification-service";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }
  const unreadNotifications = await getUnreadNotificationCount(session).catch((err: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[AppShell] notification count failed:", err instanceof Error ? err.message : err);
    }
    return 0;
  });

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-[linear-gradient(180deg,var(--color-sidebar)_0%,var(--color-sidebar-strong)_100%)] px-6 py-8 text-[var(--color-sidebar-text)] lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
        <LogoMark />

        {/* User card */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Signed in as</p>
          <p className="mt-3 font-semibold text-white">{session.user.fullName}</p>
          <p className="text-sm text-slate-300">{session.user.email}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-200">
            <Sparkles className="h-4 w-4" />
            <span>{session.activeOrganization?.name ?? "No active organization"}</span>
          </div>
        </div>

        {/* Scrollable nav */}
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2">
            <NotificationBell unreadCount={unreadNotifications} />
          </div>
          <SidebarNav session={session} />
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 space-y-1">
          <Link href="/support/new" className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
            <MessageSquarePlus className="h-4 w-4" />
            Send Feedback
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            Public site
          </Link>
          <LogoutForm />
        </div>
      </aside>
      <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
