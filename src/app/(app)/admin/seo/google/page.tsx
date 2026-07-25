import Link from "next/link";
import { IntegrationProvider } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getGooglePlatformPublicConfig } from "@/server/seo/seo-service";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";
import { SeoTabs } from "../_components";

const googleProviders = [
  IntegrationProvider.google_search_console,
  IntegrationProvider.google_analytics,
  IntegrationProvider.secure_privacy,
  IntegrationProvider.google_recaptcha,
  IntegrationProvider.google_adsense,
];

export const dynamic = "force-dynamic";

export default async function SeoGooglePage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const [config, integrations] = await Promise.all([
    getGooglePlatformPublicConfig(),
    listPlatformIntegrations(session),
  ]);
  const rows = googleProviders.map((provider) => integrations.find((integration) => integration.provider === provider) ?? null);
  const analyticsIntegration = rows[googleProviders.indexOf(IntegrationProvider.google_analytics)];
  const securePrivacyIntegration = rows[googleProviders.indexOf(IntegrationProvider.secure_privacy)];
  const analyticsStatus = !analyticsIntegration
    ? "Not configured"
    : analyticsIntegration.status === "disabled"
      ? "Disabled"
      : config.analyticsEnabled && config.analyticsConsentRequired
        ? "Configured, consent required"
        : config.analyticsEnabled
          ? "Enabled"
          : "Configured, missing Measurement ID";
  const analyticsUpdatedAt = analyticsIntegration?.updatedAt
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(analyticsIntegration.updatedAt)
    : "Not updated yet";
  const securePrivacyStatus = !securePrivacyIntegration
    ? "Not configured"
    : securePrivacyIntegration.status === "active"
      ? "Enabled"
      : securePrivacyIntegration.status === "disabled"
        ? "Disabled"
        : "Configured";
  const securePrivacyUpdatedAt = securePrivacyIntegration?.updatedAt
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(securePrivacyIntegration.updatedAt)
    : "Not updated yet";

  return (
    <AdminShell
      session={session}
      title="Google platform SEO integrations"
      description="Search Console, Analytics, reCAPTCHA, and AdSense are configured through API Management and consumed safely by public pages."
      actions={<Button asChild><Link href="/admin/apis/categories">Open API Management</Link></Button>}
    >
      <SeoTabs active="/admin/seo/google" />
      <section className="grid gap-4 md:grid-cols-5">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Search Console</p><p className="mt-3 text-sm font-semibold">{config.searchConsoleVerification ? "Verification meta enabled" : "Not configured"}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Analytics</p><p className="mt-3 text-sm font-semibold">{analyticsStatus}</p><p className="mt-1 text-xs text-slate-500">Last updated: {analyticsUpdatedAt}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Secure Privacy CMP</p><p className="mt-3 text-sm font-semibold">{securePrivacyStatus}</p><p className="mt-1 text-xs text-slate-500">Last updated: {securePrivacyUpdatedAt}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AdSense</p><p className="mt-3 text-sm font-semibold">{config.adsenseEnabled ? "Public script enabled" : "Disabled"}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Consent</p><p className="mt-3 text-sm font-semibold">{config.analyticsConsentRequired ? "Required" : "Not required"}</p></Card>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {googleProviders.map((provider, index) => {
          const integration = rows[index];
          return (
            <Card key={provider}>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">{provider.replace(/_/g, " ")}</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Status: {integration?.status ?? "not configured"} · Credentials: {integration?.credentials.length ?? 0}
              </p>
              <Button asChild variant="secondary" className="mt-4">
                <Link href={integration ? `/admin/apis/${integration.id}` : "/admin/apis/new"}>{integration ? "Manage API" : "Create API"}</Link>
              </Button>
            </Card>
          );
        })}
      </div>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">No hardcoded Google IDs</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Browser-safe values such as Analytics measurement IDs and AdSense publisher IDs are only rendered when the corresponding active API record marks them public-client values.
        </p>
      </Card>
    </AdminShell>
  );
}
