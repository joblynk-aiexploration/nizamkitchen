import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { savedRestaurantCreateSchema } from "@/lib/validation/restaurants";
import { listSavedRestaurants, saveRestaurant } from "@/server/restaurants/restaurant-fallback-service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.activeOrganization?.id;
  if (!orgId) return NextResponse.json({ error: "No active organization." }, { status: 403 });

  const flagEnabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!flagEnabled) return NextResponse.json({ error: "Feature not enabled." }, { status: 403 });

  const saved = await listSavedRestaurants(orgId);
  return NextResponse.json(saved);
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.activeOrganization?.id;
  const countryCode = session.activeOrganization?.countryCode;
  if (!orgId || !countryCode) {
    return NextResponse.json({ error: "No active organization." }, { status: 403 });
  }

  const flagEnabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!flagEnabled) return NextResponse.json({ error: "Feature not enabled." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = savedRestaurantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input.", issues: parsed.error.issues }, { status: 422 });
  }

  const saved = await saveRestaurant({
    actorUserId: session.user.id,
    organizationId: orgId,
    countryCode,
    input: parsed.data,
  });

  return NextResponse.json(saved, { status: 201 });
}
