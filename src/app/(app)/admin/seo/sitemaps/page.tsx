import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { SeoTabs } from "../_components";

export const dynamic = "force-dynamic";

export default async function SeoSitemapsPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  return (
    <AdminShell session={session} title="Sitemap and robots" description="Review the public indexing policy for NizamKitchen.">
      <SeoTabs active="/admin/seo/sitemaps" />
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Included in sitemap</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Public pages, published recipes, public chef/caterer/restaurant profiles, and public menu templates where available.</p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Excluded from indexing</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Admin, dashboards, orders, billing, support, KYC, storage files, payment, and private account pages are blocked in robots and omitted from sitemap.</p>
        </Card>
      </section>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Live routes</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]"><code>/sitemap.xml</code>, <code>/robots.txt</code>, and <code>/ads.txt</code> are generated dynamically from public data and Google/AdSense configuration.</p>
      </Card>
    </AdminShell>
  );
}
