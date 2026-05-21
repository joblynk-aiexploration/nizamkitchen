import { SeoScope } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSeoSettings } from "@/server/seo/seo-service";
import { SeoTabs } from "../_components";

export const dynamic = "force-dynamic";

export default async function SeoSchemaPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const settings = await listSeoSettings();
  const schemaSettings = settings.filter((setting) => setting.structuredDataJson || setting.aeoFaqJson || setting.scope === SeoScope.menu_template);

  return (
    <AdminShell session={session} title="Schema and AEO previews" description="Preview structured data and FAQ content that can be rendered on public pages.">
      <SeoTabs active="/admin/seo/schema" />
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Structured data policy</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          NizamKitchen renders Organization, WebSite, Recipe, LocalBusiness, BreadcrumbList, and FAQPage schema where safe. Ratings and reviews are only emitted when verified data exists.
        </p>
      </Card>
      <AdminDataTable
        data={schemaSettings}
        emptyMessage="No schema overrides or FAQ content configured yet."
        columns={[
          { key: "scope", header: "Scope", render: (item) => item.scope.replace(/_/g, " ") },
          { key: "path", header: "Path/entity", render: (item) => item.path ?? item.entityId ?? "Global" },
          { key: "structured", header: "Structured data", render: (item) => item.structuredDataJson ? "Configured" : "Default" },
          { key: "faq", header: "FAQ/AEO", render: (item) => item.aeoFaqJson ? "Configured" : "Not set" },
        ]}
      />
    </AdminShell>
  );
}
