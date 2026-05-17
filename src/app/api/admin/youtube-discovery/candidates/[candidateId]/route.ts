import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  approveCandidate,
  rejectCandidate,
  importCandidate,
} from "@/server/youtube-discovery/candidate-service";

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
    const action = body?.get("action") as string | null;
    const isPrimary = body?.get("isPrimary") === "on" || body?.get("isPrimary") === "true";

    if (action === "approve") {
      await approveCandidate({ candidateId, actorUserId: userId, organizationId, countryCode });
      return redirectWithMessage(request, `Candidate approved.`);
    }

    if (action === "reject") {
      const reason = (body?.get("reason") as string | null) ?? undefined;
      await rejectCandidate({ candidateId, actorUserId: userId, organizationId, countryCode, reason });
      return redirectWithMessage(request, `Candidate rejected.`);
    }

    if (action === "import") {
      await importCandidate({ candidateId, actorUserId: userId, organizationId, countryCode, isPrimary });
      return redirectWithMessage(request, `Video imported successfully.`);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return redirectWithMessage(request, `Error: ${msg}`);
  }
}

function redirectWithMessage(request: Request, message: string) {
  const referer = request.headers.get("referer") ?? "/admin/youtube-discovery";
  const url = new URL(referer);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url.toString());
}
