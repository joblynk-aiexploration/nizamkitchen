import { Shield } from "lucide-react";
import type { getCurrentSession } from "@/lib/session";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export function AdminShell({
  session,
  title,
  description,
  children,
  actions,
}: {
  session: Session;
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AdminHeader
        title={title}
        description={description}
        actions={actions}
        role={session.user.platformRole ?? "viewer"}
      />
      <div className="grid gap-6 xl:grid-cols-[auto_minmax(0,1fr)]">
        <AdminSidebar session={session} />
        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fc_55%,#edf4ff_100%)] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--color-primary)]/10 p-3 text-[var(--color-primary)]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Platform control center
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  Admin activity is role-scoped, audit logged, and isolated from organization
                  administration.
                </p>
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
