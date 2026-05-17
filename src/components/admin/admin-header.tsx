import { RoleBadge } from "@/components/ui/role-badge";

export function AdminHeader({
  title,
  description,
  role,
  actions,
}: {
  title: string;
  description: string;
  role: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-white p-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
          Admin operations
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[var(--color-ink)]">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RoleBadge value={role} />
        {actions}
      </div>
    </div>
  );
}
