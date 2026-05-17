import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { AccessDeniedError } from "@/lib/auth";
import { auditAccessDenied } from "@/server/audit";
import { z } from "zod";
import { createCuisine } from "@/server/cuisines";

const cuisineCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  isGlobal: z.boolean().default(true),
});

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = cuisineCreateSchema.parse(body);
    const cuisine = await createCuisine(session, input);
    return NextResponse.json({ cuisine }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "cuisine", details: { reason: error.code } });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
