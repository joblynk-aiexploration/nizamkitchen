export function LogoMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-sm font-bold text-white shadow-lg">
        NK
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
          Enterprise SaaS
        </p>
        <h2 className="font-serif text-xl text-white">NizamKitchen</h2>
      </div>
    </div>
  );
}
