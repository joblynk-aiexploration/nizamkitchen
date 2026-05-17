import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { bulkAutoImportForMissingRecipes, importBestCandidateIfStrictlyQualified } from "@/server/youtube-discovery/video-coverage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const userId = session.user.id;
    const organizationId = session.activeOrganization?.id ?? null;
    const countryCode = session.activeOrganization?.countryCode ?? null;

    const body = await readBody(request);
    const { recipeId } = body;

    if (recipeId) {
      // Single recipe auto-import
      const result = await importBestCandidateIfStrictlyQualified({
        recipeId,
        actorUserId: userId,
        organizationId,
        countryCode,
      });
      if (result.imported) {
        return respond(request, { imported: true, candidateId: result.candidateId }, 200, "Best candidate imported successfully.");
      }
      return respond(request, { imported: false, reason: result.reason }, 200, result.reason);
    }

    // Bulk auto-import for all missing recipes
    const result = await bulkAutoImportForMissingRecipes({
      actorUserId: userId,
      organizationId,
      countryCode,
    });

    const msg = `Auto-import finished: ${result.imported} imported, ${result.skipped} skipped (no qualifying candidate), ${result.errors.length} error(s).`;
    return respond(request, result, 200, msg);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const msg = error instanceof Error ? error.message : "Auto-import failed.";
    return respond(request, { error: msg }, 500, msg);
  }
}

async function readBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await request.json().catch(() => ({})) as Record<string, string>;
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries()) as Record<string, string>;
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
