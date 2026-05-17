import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError, FULL_PLATFORM_ADMIN_ROLES, hasPlatformRole } from "@/lib/auth";
import { getRecipeById } from "@/server/recipes";
import { getMediaReferenceById, updateMediaReference, deleteMediaReference } from "@/server/media-references";
import { mediaReferenceUpdateSchema } from "@/lib/validation/video";
import { auditAccessDenied } from "@/server/audit";

type RouteParams = { params: Promise<{ id: string; refId: string }> };

async function assertAccess(session: Awaited<ReturnType<typeof getCurrentSession>>, recipeId: string, request: Request) {
  if (!session) throw new AccessDeniedError("Not authenticated.", "UNAUTHENTICATED");
  const recipe = await getRecipeById(recipeId);
  if (!recipe) throw new Error("Recipe not found.");
  const isPlatformAdmin = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
  const isOrgOwner = recipe.organizationId === session.activeOrganization?.id;
  if (!isPlatformAdmin && !isOrgOwner) {
    throw new AccessDeniedError("Not authorized.", "ROLE_REQUIRED");
  }
  return recipe;
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getCurrentSession();
  const { id: recipeId, refId } = await params;

  try {
    const recipe = await assertAccess(session, recipeId, request);
    const formData = await request.formData();
    const method = formData.get("_method");

    if (method === "DELETE") {
      await deleteMediaReference({
        id: refId,
        recipeId,
        actorUserId: session!.user.id,
        organizationId: recipe.organizationId,
        countryCode: recipe.countryCode,
      });
      revalidatePath(`/recipes/${recipeId}`);
      revalidatePath(`/recipes/${recipeId}/edit`);
      return NextResponse.redirect(
        new URL(`/recipes/${recipeId}/edit?message=Video+reference+removed.`, request.url),
      );
    }

    const input = mediaReferenceUpdateSchema.parse({
      title: formData.get("title"),
      url: formData.get("url"),
      language: formData.get("language"),
      creatorName: formData.get("creatorName"),
      durationSeconds: formData.get("durationSeconds"),
      isPrimary: formData.get("isPrimary"),
      displayOrder: formData.get("displayOrder"),
      notes: formData.get("notes"),
    });

    await updateMediaReference({
      id: refId,
      recipeId,
      input,
      actorUserId: session!.user.id,
      organizationId: recipe.organizationId,
      countryCode: recipe.countryCode,
    });

    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath(`/recipes/${recipeId}/edit`);
    return NextResponse.redirect(
      new URL(`/recipes/${recipeId}/edit?message=Video+reference+updated.`, request.url),
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (session) await auditAccessDenied({ session, targetType: "recipe_media_reference", targetId: refId });
      return NextResponse.redirect(
        new URL(`/recipes/${recipeId}/edit?message=Access+denied.`, request.url),
      );
    }
    const msg = error instanceof Error ? error.message : "Unable to update media reference.";
    return NextResponse.redirect(
      new URL(`/recipes/${recipeId}/edit?message=${encodeURIComponent(msg)}`, request.url),
    );
  }
}

// DELETE via proper method (for future fetch() clients)
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getCurrentSession();
  const { id: recipeId, refId } = await params;
  try {
    const recipe = await assertAccess(session, recipeId, request);
    await deleteMediaReference({
      id: refId,
      recipeId,
      actorUserId: session!.user.id,
      organizationId: recipe.organizationId,
      countryCode: recipe.countryCode,
    });
    revalidatePath(`/recipes/${recipeId}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to delete." }, { status: 500 });
  }
}
