import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMenus, listMenusForOrganization } from "@/server/menus";

export const dynamic = "force-dynamic";

export default async function RestaurantMenusPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") return <EmptyState title="Restaurant only" description="Menu builder is available for restaurant organizations." />;
  const enabled = await canAccessMenus({ organizationId: session.activeOrganization.id, organizationType: "restaurant", platformRole: session.user.platformRole });
  if (!enabled) return <EmptyState title="Restaurant profiles coming soon" description="Restaurant menu management is not enabled yet." />;
  const menus = await listMenusForOrganization(session.activeOrganization.id);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title="Menus" description="Create public or private restaurant menus for household browsing." actions={<Button asChild><Link href="/restaurant/menu/new">Create menu</Link></Button>} />
      {menus.length === 0 ? <EmptyState title="No menus yet" description="Create a menu before adding restaurant dishes." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu) => (
            <Link key={menu.id} href={`/restaurant/menu/${menu.id}`}>
              <Card className="h-full">
                <h2 className="text-xl font-semibold">{menu.name}</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{menu.description || "No description."}</p>
                <div className="mt-4 flex gap-2"><Badge tone={menu.status === "active" ? "success" : "warning"}>{menu.status}</Badge><Badge tone={menu.visibility === "public" ? "success" : "neutral"}>{menu.visibility}</Badge></div>
                <p className="mt-4 text-sm font-semibold">{menu._count.items} items</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
