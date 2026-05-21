import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listDishTemplates, listMenuTemplates } from "@/server/templates";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [dishTemplates, menuTemplates] = await Promise.all([
    listDishTemplates(session),
    listMenuTemplates(session),
  ]);

  return (
    <AdminShell session={session} title="Template Library" description="Manage platform-owned dish and menu templates by city, state, country, seller type, cuisine, and occasion.">
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dish templates</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--color-ink)]">{dishTemplates.length}</p>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Reusable dish definitions with ingredients, steps, default servings, prices, spice level, and geography.</p>
          <div className="mt-5 flex gap-3">
            <Button asChild><Link href="/admin/templates/dishes">Manage dishes</Link></Button>
            <Button asChild variant="secondary"><Link href="/admin/templates/dishes/new">New dish</Link></Button>
          </div>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Menu templates</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--color-ink)]">{menuTemplates.length}</p>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Daily, weekly, monthly, Ramadan, Eid, party, wedding, seller, and household plans built from dishes or recipes.</p>
          <div className="mt-5 flex gap-3">
            <Button asChild><Link href="/admin/templates/menus">Manage menus</Link></Button>
            <Button asChild variant="secondary"><Link href="/admin/templates/menus/new">New menu</Link></Button>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
