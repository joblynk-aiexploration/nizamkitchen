import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError, FULL_PLATFORM_ADMIN_ROLES, hasPlatformRole } from "@/lib/auth";
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
    const recipe = await getRecipeById(recipeId);
    if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

    const isPlatformAdmin = hasPlatformRole(session.user.platformRole, FULL_PLATFORM_ADMIN_ROLES);
    const isOrgOwner = recipe.organizationId === session.activeOrganization?.id;
    if (!isPlatformAdmin && !isOrgOwner) {
      throw new AccessDeniedError("Not authorized to manage this recipe's media.", "ROLE_REQUIRED");
    }

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
      organizationId: recipe.organizationId,
      countryCode: recipe.countryCode,
    });

    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath(`/recipes/${recipeId}/edit`);
    return NextResponse.redirect(
      new URL(`/recipes/${recipeId}/edit?message=Video+reference+added.`, request.url),
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "recipe_media_reference", targetId: recipeId });
      return NextResponse.redirect(
        new URL(`/recipes/${recipeId}/edit?message=Access+denied.`, request.url),
      );
    }
    const msg = error instanceof Error ? error.message : "Unable to add media reference.";
    return NextResponse.redirect(
      new URL(`/recipes/${recipeId}/edit?message=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
