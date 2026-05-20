type SocialAuthButton = {
  provider: "google" | "facebook";
  label: string;
  href: string;
};

export function SocialAuthButtons({
  providers,
}: {
  providers: SocialAuthButton[];
}) {
  if (!providers.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {providers.map((provider) => (
          <a
            key={provider.provider}
            href={provider.href}
            className="flex w-full items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
          >
            Continue with {provider.label}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span>or use email</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
