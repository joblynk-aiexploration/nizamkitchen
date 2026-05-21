import { SeoScope } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSeoSettings } from "@/server/seo/seo-service";
import { SeoTabs } from "../_components";
import { SeoSettingForm } from "../seo-form";

export const dynamic = "force-dynamic";

export default async function SeoRecipesPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const settings = await listSeoSettings({ scope: SeoScope.recipe });

  return (
    <AdminShell session={session} title="Recipe SEO" description="Override metadata and schema for individual public recipes without adding fake ratings.">
      <SeoTabs active="/admin/seo/recipes" />
      <SeoSettingForm defaultScope={SeoScope.recipe} />
      <AdminDataTable
        data={settings}
        emptyMessage="No recipe-specific SEO settings yet."
        columns={[
          { key: "entity", header: "Recipe entity", render: (item) => item.entityId ?? "Not linked" },
          { key: "title", header: "Title", render: (item) => item.metaTitle ?? "Recipe fallback title" },
          { key: "aeo", header: "AEO summary", render: (item) => item.aeoSummary ? "Configured" : "Not set" },
          { key: "active", header: "Active", render: (item) => item.isActive ? "Yes" : "No" },
        ]}
      />
    </AdminShell>
  );
}
