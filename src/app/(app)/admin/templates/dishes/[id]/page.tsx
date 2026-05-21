import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DishTemplateForm } from "../../_forms";
import { archiveDishTemplateAction, cloneDishTemplateAction, upsertDishTemplateAction } from "../../actions";
import { getDishTemplate } from "@/server/templates";

export const dynamic = "force-dynamic";

export default async function DishTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const template = await getDishTemplate(session, id);
  if (!template) notFound();
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title={template.name}
      description="Preview, clone, publish, disable, or archive this dish template."
      actions={<Button asChild variant="secondary"><Link href="/admin/templates/dishes">Back</Link></Button>}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          {canMutate ? <DishTemplateForm template={template} action={upsertDishTemplateAction} /> : <p className="text-sm text-[var(--color-muted)]">Read-only access.</p>}
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Template actions</h2>
          <form action={cloneDishTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="secondary" className="w-full" disabled={!canMutate}>Clone template</Button>
          </form>
          <form action={archiveDishTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="danger" className="w-full" disabled={!canMutate}>Archive template</Button>
          </form>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            City templates override state templates, state templates override country templates, and global templates are the fallback.
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
