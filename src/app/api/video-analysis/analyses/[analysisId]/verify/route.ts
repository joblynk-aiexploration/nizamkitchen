import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError, assertPlatformRole } from "@/lib/auth";
import { updateVerificationStatus } from "@/server/video-analysis/video-analysis-service";
import { verificationUpdateSchema } from "@/lib/validation/video";
import { auditAccessDenied } from "@/server/audit";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ analysisId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const { analysisId } = await params;

  try {
    assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

    const analysis = await prisma.recipeVideoAnalysis.findUnique({ where: { id: analysisId } });
    if (!analysis) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

    const formData = await request.formData();
    const input = verificationUpdateSchema.parse({
      verificationStatus: formData.get("verificationStatus"),
      notes: formData.get("notes"),
    });

    await updateVerificationStatus({
      analysisId,
      actorUserId: session.user.id,
      organizationId: analysis.organizationId,
      countryCode: analysis.countryCode,
      input,
    });

    revalidatePath(`/admin/recipe-library/${analysis.recipeId}`);
    revalidatePath(`/recipes/${analysis.recipeId}`);

    return NextResponse.redirect(
      new URL(`/admin/recipe-library/${analysis.recipeId}?message=Verification+updated.`, request.url),
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "recipe_video_analysis", targetId: analysisId, details: { reason: error.code } });
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    const msg = error instanceof Error ? error.message : "Unable to update verification.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
