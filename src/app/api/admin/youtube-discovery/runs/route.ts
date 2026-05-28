import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { enforceRateLimit, rateLimitKey, rateLimitPolicies } from "@/lib/security";
import { runDiscoveryForRecipe, runDiscoveryForAllRecipes } from "@/server/youtube-discovery/discovery-service";
import { isYouTubeDiscoveryAvailable, getYouTubeDiscoveryConfig } from "@/lib/youtube-discovery-config";
import { youtubeDiscoveryRunSchema } from "@/lib/validation/video";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const userId = session.user.id;
    const organizationId = session.activeOrganization?.id ?? null;
    const countryCode = session.activeOrganization?.countryCode ?? null;

    try {
      enforceRateLimit({
        key: rateLimitKey("youtube-discovery", request, userId),
        ...rateLimitPolicies.youtubeDiscovery,
      });
    } catch {
      return respond(request, { error: "Too many YouTube discovery requests. Please wait and try again." }, 429, "Too many YouTube discovery requests. Please wait and try again.");
    }

    if (!(await isYouTubeDiscoveryAvailable())) {
      const cfg = await getYouTubeDiscoveryConfig();
      const message = cfg.enabled ? "YouTube discovery configuration is invalid." : (cfg as { enabled: false; reason: string }).reason;
      return respond(request, { error: message }, 422, message);
    }

    const input = youtubeDiscoveryRunSchema.parse(await readRequestBody(request));
    const { recipeId, mode, forceRefresh } = input;

    if (recipeId) {
      const result = await runDiscoveryForRecipe({
        recipeId,
        requestedByUserId: userId,
        organizationId,
        countryCode,
        forceRefresh,
      });
      if (!result.success) {
        return respond(request, { error: result.error }, 422, result.error);
      }
      return respond(
        request,
        { runId: result.runId, candidatesFound: result.candidatesFound },
        200,
        result.candidatesFound > 0 ? `Discovery completed. Found ${result.candidatesFound} new candidate${result.candidatesFound === 1 ? "" : "s"}.` : "Discovery completed. No new candidates found for this recipe.",
      );
    }

    // Bulk mode
    const missingOnly = mode === "missing";
    const result = await runDiscoveryForAllRecipes({
      requestedByUserId: userId,
      organizationId,
      countryCode,
      missingOnly,
    });

    const failureSummary = result.failed.length > 0 ? ` ${result.failed.length} recipe${result.failed.length === 1 ? "" : "s"} failed.` : "";
    return respond(
      request,
      result,
      result.failed.length > 0 && result.started === 0 ? 422 : 200,
      `Discovery finished: ${result.started} recipe${result.started === 1 ? "" : "s"} searched, ${result.skipped} skipped.${failureSummary}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const msg = getSafeDiscoveryError(error);
    if (process.env.NODE_ENV !== "production") {
      console.error("[youtube-discovery] run failed", error);
    }
    return respond(request, { error: msg }, 500, msg);
  }
}

async function readRequestBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await request.json().catch(() => ({}));
  }
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }
  return {};
}

function respond(request: Request, body: Record<string, unknown>, status: number, message: string) {
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  if (!acceptsHtml) {
    return NextResponse.json(body, { status });
  }

  const referer = request.headers.get("referer") ?? "/admin/youtube-discovery";
  const url = new URL(referer);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url.toString());
}

function getSafeDiscoveryError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("YOUTUBE_DATA_API_KEY")) return "YouTube API key is missing.";
    if (error.message.includes("YouTube discovery is disabled")) return "YouTube discovery is disabled.";
    if (error.message.includes("YouTube") && error.message.includes("API error")) {
      return "YouTube discovery failed. Check the server logs for the API response.";
    }
  }
  return "Unable to run YouTube discovery.";
}
