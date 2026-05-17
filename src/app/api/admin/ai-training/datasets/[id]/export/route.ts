import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError, assertPlatformRole } from "@/lib/auth";
import { auditAccessDenied } from "@/server/audit";
import { exportDatasetAsJsonl } from "@/server/ai-training";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const { id } = await params;

  try {
    assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
    const jsonl = await exportDatasetAsJsonl({ datasetId: id, actorUserId: session.user.id });
    return new Response(jsonl, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="nizamkitchen-ai-training-${id}.jsonl"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "ai_training_dataset", targetId: id, details: { reason: error.code } });
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unable to export dataset.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
