import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { runDiscoveryForRecipe, runDiscoveryForAllRecipes } from "@/server/youtube-discovery/discovery-service";
import { isYouTubeDiscoveryAvailable, getYouTubeDiscoveryConfig } from "@/lib/youtube-discovery-config";

export async function POST(request: Request) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const userId = session.user.id;
    const organizationId = session.activeOrganization?.id ?? null;
    const countryCode = session.activeOrganization?.countryCode ?? null;

    if (!isYouTubeDiscoveryAvailable()) {
      const cfg = getYouTubeDiscoveryConfig();
      return NextResponse.json(
        { error: cfg.enabled ? "Unknown config error" : (cfg as { enabled: false; reason: string }).reason },
        { status: 422 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { recipeId, mode } = body as { recipeId?: string; mode?: "all" | "missing" };

    if (recipeId) {
      const forceRefresh = body.forceRefresh === true;
      const result = await runDiscoveryForRecipe({
        recipeId,
        requestedByUserId: userId,
        organizationId,
        countryCode,
        forceRefresh,
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 422 });
      }
      return NextResponse.json({ runId: result.runId, candidatesFound: result.candidatesFound });
    }

    // Bulk mode
    const missingOnly = mode === "missing";
    const result = await runDiscoveryForAllRecipes({
      requestedByUserId: userId,
      organizationId,
      countryCode,
      missingOnly,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
