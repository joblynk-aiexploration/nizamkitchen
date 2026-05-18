import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href="/notifications"
      className="relative flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
    >
      <Bell className="h-4 w-4" />
      <span>Notifications</span>
      {unreadCount > 0 && (
        <span className="ml-auto rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-bold text-slate-950">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
