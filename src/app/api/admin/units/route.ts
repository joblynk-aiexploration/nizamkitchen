import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError } from "@/lib/auth";
import { auditAccessDenied } from "@/server/audit";
import { unitCreateSchema } from "@/lib/validation/recipes";
import { createUnit } from "@/server/units";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = unitCreateSchema.parse(body);
    const unit = await createUnit(session, input);
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "unit", details: { reason: error.code } });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
