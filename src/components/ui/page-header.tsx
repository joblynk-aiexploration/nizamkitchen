export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl font-semibold text-[var(--color-ink)]">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
