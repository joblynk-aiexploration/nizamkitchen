import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  recheckMediaReferenceAvailability,
  recheckCandidateAvailability,
  recheckAllMediaReferences,
} from "@/server/youtube-discovery/availability-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const userId = session.user.id;
    const organizationId = session.activeOrganization?.id ?? null;
    const countryCode = session.activeOrganization?.countryCode ?? null;

    const body = await readBody(request);
    const { target, mediaReferenceId, candidateId, recipeId } = body;

    if (target === "candidate" && candidateId) {
      const result = await recheckCandidateAvailability({
        candidateId,
        actorUserId: userId,
        organizationId,
        countryCode,
      });
      return respond(request, { result }, 200, `Candidate availability checked: ${result.status}.`);
    }

    if (target === "media_reference" && mediaReferenceId) {
      const result = await recheckMediaReferenceAvailability({
        mediaReferenceId,
        actorUserId: userId,
        organizationId,
        countryCode,
      });
      return respond(request, { result }, 200, `Video availability checked: ${result.status}.`);
    }

    if (target === "all") {
      const result = await recheckAllMediaReferences({
        actorUserId: userId,
        organizationId,
        countryCode,
        recipeId: recipeId ?? undefined,
      });
      const msg = `Rechecked ${result.checked} video${result.checked !== 1 ? "s" : ""}. ${result.unavailable} unavailable.${result.errors.length > 0 ? ` ${result.errors.length} error(s).` : ""}`;
      return respond(request, result, 200, msg);
    }

    return NextResponse.json({ error: "Invalid request. Provide target=candidate|media_reference|all." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const msg = error instanceof Error ? error.message : "Availability check failed.";
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
  const referer = request.headers.get("referer") ?? "/admin/recipe-library";
  const url = new URL(referer);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url.toString());
}
