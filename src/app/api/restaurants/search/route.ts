import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { restaurantSearchSchema } from "@/lib/validation/restaurants";
import { runRestaurantSearch } from "@/server/restaurants/restaurant-fallback-service";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.activeOrganization?.id;
  const countryCode = session.activeOrganization?.countryCode;
  if (!orgId || !countryCode) {
    return NextResponse.json({ error: "No active organization." }, { status: 403 });
  }

  const flagEnabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!flagEnabled) {
    return NextResponse.json({ error: "Feature not enabled." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = restaurantSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input.", issues: parsed.error.issues }, { status: 422 });
  }

  const { searchId } = await runRestaurantSearch({
    actorUserId: session.user.id,
    organizationId: orgId,
    countryCode,
    input: parsed.data,
  });

  return NextResponse.json({ searchId }, { status: 201 });
}
