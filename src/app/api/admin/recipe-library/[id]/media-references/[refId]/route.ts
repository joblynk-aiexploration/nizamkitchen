import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError, assertPlatformRole } from "@/lib/auth";
import { getRecipeById } from "@/server/recipes";
import { updateMediaReference, deleteMediaReference } from "@/server/media-references";
import { mediaReferenceUpdateSchema } from "@/lib/validation/video";
import { auditAccessDenied } from "@/server/audit";

type RouteParams = { params: Promise<{ id: string; refId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const { id: recipeId, refId } = await params;

  try {
    assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
    const recipe = await getRecipeById(recipeId);
    if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

    const formData = await request.formData();
    const method = formData.get("_method");

    if (method === "DELETE") {
      await deleteMediaReference({
        id: refId,
        recipeId,
        actorUserId: session.user.id,
        organizationId: null,
        countryCode: recipe.countryCode,
      });
      revalidatePath(`/admin/recipe-library/${recipeId}`);
      revalidatePath(`/recipes/${recipeId}`);
      return NextResponse.redirect(
        new URL(`/admin/recipe-library/${recipeId}?message=Video+reference+removed.`, request.url),
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
      actorUserId: session.user.id,
      organizationId: null,
      countryCode: recipe.countryCode,
    });

    revalidatePath(`/admin/recipe-library/${recipeId}`);
    revalidatePath(`/recipes/${recipeId}`);
    return NextResponse.redirect(
      new URL(`/admin/recipe-library/${recipeId}?message=Video+reference+updated.`, request.url),
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "recipe_media_reference", targetId: refId, details: { reason: error.code } });
      return NextResponse.redirect(
        new URL(`/admin/recipe-library/${recipeId}?message=Access+denied.`, request.url),
      );
    }
    const msg = error instanceof Error ? error.message : "Unable to update media reference.";
    return NextResponse.redirect(
      new URL(`/admin/recipe-library/${recipeId}?message=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
