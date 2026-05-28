type SocialAuthButton = {
  provider: "google" | "facebook";
  label: string;
  href: string;
  configured?: boolean;
  setupMessage?: string;
};

export function SocialAuthButtons({
  providers,
  showDivider = true,
}: {
  providers: SocialAuthButton[];
  showDivider?: boolean;
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
            aria-label={`Continue with ${provider.label}`}
            className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3.5 text-left text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[var(--focus-ring)]/20"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-slate-50 transition group-hover:bg-white">
              <SocialProviderLogo provider={provider.provider} />
            </span>
            <span className="min-w-0">
              <span className="block">Continue with {provider.label}</span>
              <span className="mt-0.5 block text-xs font-medium text-[var(--text-secondary)]">
                Use your secure {provider.label} account
              </span>
            </span>
          </a>
        ))}
      </div>
      {showDivider ? (
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
          <span className="h-px flex-1 bg-[var(--color-border)]" />
          <span>or use email</span>
          <span className="h-px flex-1 bg-[var(--color-border)]" />
        </div>
      ) : null}
    </div>
  );
}

function SocialProviderLogo({ provider }: { provider: "google" | "facebook" }) {
  if (provider === "facebook") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          fill="#1877F2"
          d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.438H7.078v-3.49h3.047V9.414c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971h-1.513c-1.49 0-1.956.93-1.956 1.886v2.263h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M23.64 12.205c0-.795-.071-1.56-.205-2.295H12v4.34h6.53a5.58 5.58 0 0 1-2.42 3.66v2.99h3.92c2.29-2.11 3.61-5.22 3.61-8.695Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.075 7.945-2.915l-3.92-2.99c-1.09.73-2.48 1.16-4.025 1.16-3.13 0-5.78-2.115-6.725-4.955H1.225v3.085A11.995 11.995 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.275 14.3A7.213 7.213 0 0 1 4.9 12c0-.8.135-1.575.375-2.3V6.615H1.225A11.995 11.995 0 0 0 0 12c0 1.93.46 3.755 1.225 5.385L5.275 14.3Z" />
      <path fill="#EA4335" d="M12 4.745c1.76 0 3.34.605 4.585 1.795l3.445-3.445C17.955 1.165 15.235 0 12 0A11.995 11.995 0 0 0 1.225 6.615L5.275 9.7C6.22 6.86 8.87 4.745 12 4.745Z" />
    </svg>
  );
}
