import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError } from "@/lib/auth";
import { auditAccessDenied } from "@/server/audit";
import { ingredientUpdateSchema } from "@/lib/validation/recipes";
import { updateIngredient } from "@/server/ingredients";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const input = ingredientUpdateSchema.parse(body);
    const ingredient = await updateIngredient(session, id, input);
    return NextResponse.json({ ingredient });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "ingredient", targetId: id, details: { reason: error.code } });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
