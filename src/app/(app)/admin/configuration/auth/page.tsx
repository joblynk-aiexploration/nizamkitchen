import Link from "next/link";
import { IntegrationProvider } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  {
    provider: IntegrationProvider.google_oauth,
    label: "Google OAuth",
    href: "/admin/configuration/auth/google",
    callbackPath: "/api/auth/oauth/google/callback",
  },
  {
    provider: IntegrationProvider.facebook_oauth,
    label: "Facebook OAuth",
    href: "/admin/configuration/auth/facebook",
    callbackPath: "/api/auth/oauth/facebook/callback",
  },
];

export default async function AdminAuthConfigurationPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const integrations = await listPlatformIntegrations(session);

  return (
    <AdminShell
      session={session}
      title="Social auth providers"
      description="Manage Google and Facebook login, callback URLs, masked client secrets, and button visibility from the platform vault."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const integration = integrations.find((item) => item.provider === provider.provider);
          const callbackUrl =
            typeof integration?.settings.find((setting) => setting.settingKey === "callbackUrl")?.settingValueJson === "string"
              ? String(integration?.settings.find((setting) => setting.settingKey === "callbackUrl")?.settingValueJson)
              : new URL(provider.callbackPath, env.APP_URL).toString();

          return (
            <Card key={provider.provider}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-ink)]">{provider.label}</h2>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    Callback URL: <code>{callbackUrl}</code>
                  </p>
                </div>
                <Badge tone={integration?.status === "active" ? "success" : "warning"}>
                  {integration?.status ?? "not configured"}
                </Badge>
              </div>
              <p className="mt-4 text-sm text-[var(--color-muted)]">
                Platform Owner controls enablement, client credentials, allowed domains, auto-create behavior, and login button visibility from this provider page.
              </p>
              <div className="mt-5">
                <Link
                  href={provider.href}
                  className="inline-flex rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                >
                  Open {provider.label} settings
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
    </AdminShell>
  );
}
