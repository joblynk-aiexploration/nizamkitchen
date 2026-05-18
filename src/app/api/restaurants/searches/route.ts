import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listSearches } from "@/server/restaurants/restaurant-fallback-service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.activeOrganization?.id;
  if (!orgId) return NextResponse.json({ error: "No active organization." }, { status: 403 });

  const flagEnabled = await isFeatureEnabled("restaurant_fallback", orgId);
  if (!flagEnabled) return NextResponse.json({ error: "Feature not enabled." }, { status: 403 });

  const searches = await listSearches(orgId);
  return NextResponse.json(searches);
}
