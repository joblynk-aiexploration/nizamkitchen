import { SeoScope } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSeoSettings } from "@/server/seo/seo-service";
import { SeoTabs } from "../_components";
import { SeoSettingForm } from "../seo-form";

export const dynamic = "force-dynamic";

export default async function SeoPagesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner"]);
  const [params, settings] = await Promise.all([searchParams, listSeoSettings()]);
  const pageSettings = settings.filter((setting) => ["page", "custom_path", "city_page", "country_page"].includes(setting.scope));

  return (
    <AdminShell session={session} title="Page SEO" description="Create path, city, country, and custom-page metadata overrides.">
      <SeoTabs active="/admin/seo/pages" />
      {params.message ? <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{params.message}</div> : null}
      <SeoSettingForm defaultScope={SeoScope.page} defaultPath="/features" />
      <AdminDataTable
        data={pageSettings}
        emptyMessage="No page-specific SEO settings yet."
        columns={[
          { key: "path", header: "Path", render: (item) => item.path ?? "No path" },
          { key: "scope", header: "Scope", render: (item) => item.scope.replace(/_/g, " ") },
          { key: "title", header: "Title", render: (item) => item.metaTitle ?? "Fallback title" },
          { key: "description", header: "Description", render: (item) => item.metaDescription ?? "Fallback description" },
          { key: "robots", header: "Robots", render: (item) => item.robotsDirective ?? "index_follow" },
        ]}
      />
    </AdminShell>
  );
}
