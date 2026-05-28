import { SeoScope } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSeoSettings } from "@/server/seo/seo-service";
import { SeoTabs } from "../_components";
import { SeoSettingForm } from "../seo-form";

export const dynamic = "force-dynamic";

export default async function SeoGlobalPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const [global] = await listSeoSettings({ scope: SeoScope.global });

  return (
    <AdminShell session={session} title="Global SEO defaults" description="Set default title, description, robots, Open Graph, Twitter/X, FAQ, and schema fallbacks.">
      <SeoTabs active="/admin/seo/global" />
      <SeoSettingForm setting={global} defaultScope={SeoScope.global} defaultPath="/" />
      <Card className="text-sm text-[var(--color-muted)]">
        Entity and page-specific settings override global defaults. If nothing is configured, NizamKitchen uses safe built-in metadata.
      </Card>
    </AdminShell>
  );
}
