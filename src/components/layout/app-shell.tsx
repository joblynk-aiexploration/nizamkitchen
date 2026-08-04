import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Inbox, MessageSquarePlus, Settings2, Sparkles, User } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { FEATURE_REGISTRY, getEnabledFeatureKeys } from "@/lib/feature-flags";
import { initialsFromName } from "@/components/profiles/profile-components";
import { LogoMark } from "@/components/layout/logo-mark";
import { LogoutForm } from "@/components/layout/logout-form";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { getUnreadNotificationCount } from "@/server/notifications/notification-service";
import { hasAcceptedLatestRequiredDocuments } from "@/server/legal/legal-service";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getUserOAuthAvatarImageUrl } from "@/server/users/profile";

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
  const legalAcceptance = await hasAcceptedLatestRequiredDocuments(session).catch((err: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[AppShell] legal acceptance check failed:", err instanceof Error ? err.message : err);
    }
    return { accepted: true, missing: [] };
  });
  const [oauthAvatarUrl, avatarUrl, enabledFeatureKeys] = await Promise.all([
    getUserOAuthAvatarImageUrl(session.user.id),
    getStorageImageUrl(session, session.user.profilePhotoFileId),
    session.user.platformRole
      ? Promise.resolve(FEATURE_REGISTRY.map((f) => f.key))
      : session.activeOrganization
        ? getEnabledFeatureKeys(session.activeOrganization.id)
        : Promise.resolve([]),
  ]);
  const resolvedAvatarUrl = avatarUrl ?? oauthAvatarUrl;
  const initials = initialsFromName(session.user.fullName);
  const accountSettingsHref = session.user.platformRole ? "/admin/settings" : "/settings/profile";
  const navSession = {
    user: { platformRole: session.user.platformRole },
    activeMembership: session.activeMembership ? { role: session.activeMembership.role } : null,
    activeOrganization: session.activeOrganization
      ? { organizationType: session.activeOrganization.organizationType }
      : null,
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex flex-col bg-[linear-gradient(180deg,var(--color-sidebar)_0%,var(--color-sidebar-strong)_100%)] px-6 py-8 text-[var(--color-sidebar-text)] lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden">
        <LogoMark />

        {/* User card */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-4">
          <div className="flex items-center gap-3">
            {resolvedAvatarUrl ? (
              <img
                src={resolvedAvatarUrl}
                alt={session.user.fullName}
                className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700/60 ring-2 ring-white/20">
                <span className="text-sm font-semibold text-white">{initials}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{session.user.fullName}</p>
              <p className="truncate text-xs text-slate-300">{session.user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-200">
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{session.activeOrganization?.name ?? "No active organization"}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <User className="h-3.5 w-3.5" />
              My Profile
            </Link>
            <Link
              href={accountSettingsHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </Link>
          </div>
        </div>

        {/* Scrollable nav */}
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2">
            <NotificationBell unreadCount={unreadNotifications} />
          </div>
          <SidebarNav session={navSession} enabledFeatureKeys={enabledFeatureKeys} />
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 space-y-1">
          <Link href="/support/tickets" className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">
            <Inbox className="h-4 w-4" />
            My tickets
          </Link>
          <Link href="/support/new" className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">
            <MessageSquarePlus className="h-4 w-4" />
            Submit a ticket
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            Public site
          </Link>
          <LogoutForm />
        </div>
      </aside>
      <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          {!legalAcceptance.accepted && session.user.platformRole !== "platform_owner" && (
            <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Updated terms require your acceptance before some marketplace actions can continue.</span>
                <Link href="/legal/accept-required" className="font-semibold text-amber-900 underline">
                  Review and accept
                </Link>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
