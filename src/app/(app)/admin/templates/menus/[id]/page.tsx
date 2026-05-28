import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MenuTemplateForm } from "../../_forms";
import { archiveMenuTemplateAction, cloneMenuTemplateAction, upsertMenuTemplateAction } from "../../actions";
import { getMenuTemplate } from "@/server/templates";

export const dynamic = "force-dynamic";

export default async function MenuTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const template = await getMenuTemplate(session, id);
  if (!template) notFound();
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title={template.name}
      description="Preview, clone, publish, disable, or archive this menu template."
      actions={<Button asChild variant="secondary"><Link href="/admin/templates/menus">Back</Link></Button>}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          {canMutate ? <MenuTemplateForm template={template} action={upsertMenuTemplateAction} /> : <p className="text-sm text-[var(--color-muted)]">Read-only access.</p>}
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Template actions</h2>
          <form action={cloneMenuTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="secondary" className="w-full" disabled={!canMutate}>Clone template</Button>
          </form>
          <form action={archiveMenuTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="danger" className="w-full" disabled={!canMutate}>Archive template</Button>
          </form>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            Menu items can reference a dish template ID, a recipe ID, or a name snapshot for custom entries.
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
