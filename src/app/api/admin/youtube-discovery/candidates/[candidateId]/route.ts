import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  approveCandidate,
  rejectCandidate,
  importCandidate,
} from "@/server/youtube-discovery/candidate-service";
import { youtubeCandidateActionSchema } from "@/lib/validation/video";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const { candidateId } = await params;
    const userId = session.user.id;
    const organizationId = session.activeOrganization?.id ?? null;
    const countryCode = session.activeOrganization?.countryCode ?? null;

    const body = await request.formData().catch(() => null);
    const input = youtubeCandidateActionSchema.parse({
      action: body?.get("action"),
      isPrimary: body?.get("isPrimary") === "on" || body?.get("isPrimary") === "true",
      reason: body?.get("reason"),
    });

    if (input.action === "approve") {
      await approveCandidate({ candidateId, actorUserId: userId, organizationId, countryCode });
      return redirectWithMessage(request, `Candidate approved.`);
    }

    if (input.action === "reject") {
      await rejectCandidate({ candidateId, actorUserId: userId, organizationId, countryCode, reason: input.reason });
      return redirectWithMessage(request, `Candidate rejected.`);
    }

    if (input.action === "import") {
      await importCandidate({ candidateId, actorUserId: userId, organizationId, countryCode, isPrimary: input.isPrimary });
      return redirectWithMessage(request, `Video imported successfully.`);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[youtube-discovery] candidate action failed", error);
    }
    return redirectWithMessage(request, getSafeCandidateActionError(error));
  }
}

function redirectWithMessage(request: Request, message: string) {
  const referer = request.headers.get("referer") ?? "/admin/youtube-discovery";
  const url = new URL(referer);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url.toString());
}

function getSafeCandidateActionError(error: unknown) {
  if (!(error instanceof Error)) return "Unable to update candidate.";
  if (error.message.includes("already imported")) return "This video was already imported.";
  if (error.message.includes("rejected candidate")) return "Rejected candidates cannot be imported.";
  if (error.message.includes("not found")) return "Candidate not found.";
  if (error.message.includes("Could not parse")) return "This candidate has an invalid YouTube video ID.";
  return error.message;
}
