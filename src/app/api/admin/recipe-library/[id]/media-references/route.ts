import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError, assertPlatformRole } from "@/lib/auth";
import { getRecipeById } from "@/server/recipes";
import { createMediaReference, listMediaReferencesForRecipe } from "@/server/media-references";
import { mediaReferenceCreateSchema } from "@/lib/validation/video";
import { auditAccessDenied } from "@/server/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const { id: recipeId } = await params;
  const refs = await listMediaReferencesForRecipe(recipeId);
  return NextResponse.json(refs);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const { id: recipeId } = await params;

  try {
    assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);
    const recipe = await getRecipeById(recipeId);
    if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

    const formData = await request.formData();
    const input = mediaReferenceCreateSchema.parse({
      type: formData.get("type"),
      provider: formData.get("provider"),
      title: formData.get("title"),
      url: formData.get("url"),
      language: formData.get("language"),
      creatorName: formData.get("creatorName"),
      durationSeconds: formData.get("durationSeconds"),
      isPrimary: formData.get("isPrimary"),
      displayOrder: formData.get("displayOrder"),
      notes: formData.get("notes"),
    });

    const ref = await createMediaReference({
      recipeId,
      input,
      actorUserId: session.user.id,
      organizationId: null, // platform-level action
      countryCode: recipe.countryCode,
    });

    revalidatePath(`/admin/recipe-library/${recipeId}`);
    revalidatePath(`/recipes/${recipeId}`);
    return NextResponse.redirect(
      new URL(`/admin/recipe-library/${recipeId}?message=Video+reference+added.`, request.url),
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "recipe_media_reference", targetId: recipeId, details: { reason: error.code } });
      return NextResponse.redirect(
        new URL(`/admin/recipe-library/${recipeId}?message=Access+denied.`, request.url),
      );
    }
    const msg = error instanceof Error ? error.message : "Unable to add media reference.";
    return NextResponse.redirect(
      new URL(`/admin/recipe-library/${recipeId}?message=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
