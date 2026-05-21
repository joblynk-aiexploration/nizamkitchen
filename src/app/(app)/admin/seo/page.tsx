import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSeoSettings } from "@/server/seo/seo-service";
import { SeoTabs, seoScopeLabel } from "./_components";

export const dynamic = "force-dynamic";

export default async function AdminSeoPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner"]);
  const [params, settings] = await Promise.all([searchParams, listSeoSettings()]);
  const active = settings.filter((setting) => setting.isActive).length;
  const noindex = settings.filter((setting) => setting.robotsDirective?.startsWith("noindex")).length;

  return (
    <AdminShell
      session={session}
      title="SEO / AEO"
      description="Manage public metadata, answer-engine content, schema.org JSON-LD, robots, sitemap policy, and Google webmaster integrations."
      actions={<Button asChild><Link href="/admin/seo/pages">Create setting</Link></Button>}
    >
      <SeoTabs active="/admin/seo" />
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SEO settings</p><p className="mt-3 text-2xl font-semibold">{settings.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active</p><p className="mt-3 text-2xl font-semibold">{active}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Noindex</p><p className="mt-3 text-2xl font-semibold">{noindex}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Google config</p><p className="mt-3 text-sm font-semibold"><Link href="/admin/seo/google" className="text-[var(--color-primary)]">Open Google controls</Link></p></Card>
      </section>
      <AdminDataTable
        data={settings.slice(0, 20)}
        emptyMessage="No SEO settings yet. Create a global default or page-specific override."
        columns={[
          { key: "scope", header: "Scope", render: (item) => seoScopeLabel(item.scope) },
          { key: "path", header: "Path/entity", render: (item) => item.path ?? `${item.entityType ?? "entity"}:${item.entityId ?? "not linked"}` },
          { key: "title", header: "Title", render: (item) => item.metaTitle ?? "Fallback title" },
          { key: "robots", header: "Robots", render: (item) => item.robotsDirective ?? "index_follow" },
          { key: "active", header: "Active", render: (item) => item.isActive ? "Yes" : "No" },
        ]}
      />
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">AEO guardrails</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          FAQ and structured data previews are editable, but ratings and reviews should only be added when the underlying verified review data exists.
        </p>
      </Card>
    </AdminShell>
  );
}
