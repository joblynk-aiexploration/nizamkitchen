import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { unsaveRestaurant } from "@/server/restaurants/restaurant-fallback-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.activeOrganization?.id;
  const countryCode = session.activeOrganization?.countryCode;
  if (!orgId || !countryCode) {
    return NextResponse.json({ error: "No active organization." }, { status: 403 });
  }

  const flagEnabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!flagEnabled) return NextResponse.json({ error: "Feature not enabled." }, { status: 403 });

  const { id } = await params;
  const result = await unsaveRestaurant({
    actorUserId: session.user.id,
    organizationId: orgId,
    countryCode,
    savedRestaurantId: id,
  });

  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
