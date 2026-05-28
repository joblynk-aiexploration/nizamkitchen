import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { getSellerVerificationGate } from "@/server/seller-verification-gates";

export const dynamic = "force-dynamic";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(value: string) {
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText.padStart(2, "0")} ${suffix}`;
}

export default async function RestaurantsPage() {
  const session = await requireMembership();
  const enabled = await isFeatureEnabled("restaurant_profiles", session.activeOrganization.id);
  if (!enabled) return <EmptyState title="Restaurant profiles coming soon" description="Restaurant profile browsing is not enabled yet." />;

  const restaurants = await prisma.organization.findMany({
    where: {
      organizationType: "restaurant",
      status: "active",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      countryCode: true,
      currencyCode: true,
      menus: {
        where: { status: "active", visibility: "public" },
        select: { id: true, name: true, _count: { select: { items: true } } },
        orderBy: { updatedAt: "desc" },
        take: 2,
      },
      menuItems: {
        where: { status: { in: ["active", "sold_out"] }, menu: { status: "active", visibility: "public" } },
        select: { id: true, name: true, status: true, priceAmount: true, currencyCode: true },
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
        take: 3,
      },
      fulfillmentTimeSlots: {
        where: { status: "active" },
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, slotType: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        take: 2,
      },
      _count: {
        select: {
          menuItems: { where: { status: { in: ["active", "sold_out"] }, menu: { status: "active", visibility: "public" } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const visibleRestaurants = [];
  for (const restaurant of restaurants) {
    const gate = await getSellerVerificationGate({
      organizationId: restaurant.id,
      sellerType: "restaurant",
      countryCode: restaurant.countryCode,
      capability: "public_profile",
    });
    if (gate.allowed) visibleRestaurants.push(restaurant);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Restaurants"
        title="Browse restaurant menus"
        description="Open a restaurant to view its public menu, available dishes, pickup or delivery options, and listed service hours."
      />
      {visibleRestaurants.length === 0 ? <EmptyState title="No restaurant menus yet" description="Approved restaurant menus will appear here." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleRestaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              href={`/restaurants/${restaurant.slug}`}
              className="block h-full rounded-3xl focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-lg font-semibold text-white">
                    {restaurant.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold text-[var(--color-ink)]">{restaurant.name}</h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{restaurant.countryCode} restaurant partner</p>
                  </div>
                  <Badge tone={restaurant._count.menuItems > 0 ? "success" : "neutral"}>
                    {restaurant._count.menuItems > 0 ? "Menu live" : "Menu pending"}
                  </Badge>
                </div>

                <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public menu</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {restaurant._count.menuItems > 0
                      ? `${restaurant._count.menuItems} available menu item${restaurant._count.menuItems === 1 ? "" : "s"}`
                      : "Open this restaurant to review menu setup details."}
                  </p>
                  {restaurant.menuItems.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {restaurant.menuItems.map((item) => (
                        <Badge key={item.id} tone={item.status === "sold_out" ? "warning" : "info"}>{item.name}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Hours</p>
                  {restaurant.fulfillmentTimeSlots.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--color-muted)]">Hours not listed yet.</p>
                  ) : (
                    <div className="mt-2 space-y-1 text-sm text-[var(--color-muted)]">
                      {restaurant.fulfillmentTimeSlots.map((slot) => (
                        <p key={slot.id}>
                          <span className="font-semibold text-[var(--color-ink)]">{dayNames[slot.dayOfWeek] ?? "Day"}:</span>{" "}
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <p className="mt-5 text-sm font-semibold text-[var(--color-primary)]">View restaurant menu</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
