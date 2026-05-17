import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError, FULL_PLATFORM_ADMIN_ROLES, hasPlatformRole } from "@/lib/auth";
import { getRecipeById } from "@/server/recipes";
import { getMediaReferenceById } from "@/server/media-references";
import { createAnalysisJob } from "@/server/video-analysis/video-analysis-jobs";
import { runTranscriptAnalysis } from "@/server/video-analysis/video-analysis-service";
import { videoAnalysisJobCreateSchema } from "@/lib/validation/video";
import { isAIVideoAnalysisAvailable } from "@/lib/video-analysis-config";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  try {
    const body = await request.json() as unknown;
    const input = videoAnalysisJobCreateSchema.parse(body);

    const recipe = await getRecipeById(input.recipeId);
    if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

    const mediaRef = await getMediaReferenceById(input.recipeMediaReferenceId);
    if (!mediaRef || mediaRef.recipeId !== input.recipeId) {
      return NextResponse.json({ error: "Media reference not found." }, { status: 404 });
    }

    // Authorization: platform admin or org member for org recipes
    const isPlatformAdmin = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
    const isOrgMember = recipe.organizationId === session.activeOrganization?.id;
    if (!isPlatformAdmin && !isOrgMember) {
      throw new AccessDeniedError("Not authorized.", "ROLE_REQUIRED");
    }

    const isEnabled = isAIVideoAnalysisAvailable();

    if (!isEnabled && input.sourceType !== "pasted_transcript") {
      return NextResponse.json({
        error: "AI video analysis is not configured yet. Set AI_VIDEO_ANALYSIS_ENABLED=true and configure an AI provider.",
        configured: false,
      }, { status: 503 });
    }

    const job = await createAnalysisJob({
      input,
      requestedByUserId: session.user.id,
      organizationId: recipe.organizationId,
      countryCode: recipe.countryCode,
    });

    // Run synchronously for transcript analysis (keeps MVP simple)
    if (input.sourceType === "pasted_transcript" && input.transcriptText) {
      if (!isEnabled) {
        return NextResponse.json({
          jobId: job.id,
          error: "AI video analysis is not configured yet.",
          configured: false,
        }, { status: 503 });
      }

      const result = await runTranscriptAnalysis({
        jobId: job.id,
        recipeMediaReferenceId: input.recipeMediaReferenceId,
        recipeId: input.recipeId,
        organizationId: recipe.organizationId,
        countryCode: recipe.countryCode,
        requestedByUserId: session.user.id,
        transcriptText: input.transcriptText,
      });

      return NextResponse.json({ jobId: job.id, ...result });
    }

    if (input.sourceType === "uploaded_video" || input.sourceType === "uploaded_audio") {
      return NextResponse.json({
        jobId: job.id,
        error: "Video/audio upload analysis is not yet implemented. Please paste a transcript instead.",
        configured: false,
      }, { status: 503 });
    }

    return NextResponse.json({ jobId: job.id, queued: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    const msg = error instanceof Error ? error.message : "Unable to create analysis job.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
