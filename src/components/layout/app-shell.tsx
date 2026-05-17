import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { LogoMark } from "@/components/layout/logo-mark";
import { LogoutForm } from "@/components/layout/logout-form";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="bg-[linear-gradient(180deg,var(--color-sidebar)_0%,var(--color-sidebar-strong)_100%)] px-6 py-8 text-[var(--color-sidebar-text)] lg:sticky lg:top-0 lg:h-screen">
        <LogoMark />
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Signed in as</p>
          <p className="mt-3 font-semibold text-white">{session.user.fullName}</p>
          <p className="text-sm text-slate-300">{session.user.email}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-200">
            <Sparkles className="h-4 w-4" />
            <span>{session.activeOrganization?.name ?? "No active organization"}</span>
          </div>
        </div>
        <SidebarNav session={session} />
        <div className="mt-8 border-t border-white/10 pt-6">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            Public site
          </Link>
          <div className="mt-4">
            <LogoutForm />
          </div>
        </div>
      </aside>
      <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
