import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MenuTemplateForm } from "../../_forms";
import { upsertMenuTemplateAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewMenuTemplatePage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);

  return (
    <AdminShell
      session={session}
      title="New menu template"
      description="Create a menu template for households, home catering sellers, restaurants, or chef businesses."
      actions={<Button asChild variant="secondary"><Link href="/admin/templates/menus">Back</Link></Button>}
    >
      <Card>
        <MenuTemplateForm action={upsertMenuTemplateAction} />
      </Card>
    </AdminShell>
  );
}
