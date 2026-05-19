import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMenus, listMenusForOrganization } from "@/server/menus";

export const dynamic = "force-dynamic";

export default async function CateringMenusPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Menu builder is available for home catering sellers." />;
  }
  const enabled = await canAccessMenus({ organizationId: session.activeOrganization.id, organizationType: "home_catering", platformRole: session.user.platformRole });
  if (!enabled) return <EmptyState title="Menus coming soon" description="Menu management is not enabled for this organization yet." />;
  const menus = await listMenusForOrganization(session.activeOrganization.id);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering" title="Menus" description="Group dishes into public or private menus for preorder, pickup, or delivery." actions={<Button asChild><Link href="/catering/menu/new">Create menu</Link></Button>} />
      {menus.length === 0 ? <EmptyState title="No menus yet" description="Create a menu before publishing dishes." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu) => (
            <Link key={menu.id} href={`/catering/menu/${menu.id}`}>
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
