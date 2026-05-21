import { SeoScope } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSeoSettings } from "@/server/seo/seo-service";
import { SeoTabs } from "../_components";
import { SeoSettingForm } from "../seo-form";

export const dynamic = "force-dynamic";

export default async function SeoSellerProfilesPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const settings = await listSeoSettings({ scope: SeoScope.seller_profile });

  return (
    <AdminShell session={session} title="Seller profile SEO" description="Manage safe profile metadata for chefs, caterers, and restaurants. Private verification data is never exposed.">
      <SeoTabs active="/admin/seo/seller-profiles" />
      <SeoSettingForm defaultScope={SeoScope.seller_profile} />
      <AdminDataTable
        data={settings}
        emptyMessage="No seller profile SEO settings yet."
        columns={[
          { key: "entity", header: "Seller entity", render: (item) => `${item.entityType ?? "seller"}:${item.entityId ?? "not linked"}` },
          { key: "title", header: "Title", render: (item) => item.metaTitle ?? "Seller fallback title" },
          { key: "robots", header: "Robots", render: (item) => item.robotsDirective ?? "index_follow" },
          { key: "active", header: "Active", render: (item) => item.isActive ? "Yes" : "No" },
        ]}
      />
    </AdminShell>
  );
}
