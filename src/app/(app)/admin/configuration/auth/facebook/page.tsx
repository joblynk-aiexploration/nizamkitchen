import { redirect } from "next/navigation";
import { IntegrationProvider } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPlatformIntegrations } from "@/server/config/platform-config-service";

export const dynamic = "force-dynamic";

export default async function FacebookAuthConfigurationRedirectPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const integrations = await listPlatformIntegrations(session);
  const integration = integrations.find((item) => item.provider === IntegrationProvider.facebook_oauth);

  redirect(integration ? `/admin/apis/${integration.id}` : "/admin/apis/new?provider=facebook_oauth");
}
