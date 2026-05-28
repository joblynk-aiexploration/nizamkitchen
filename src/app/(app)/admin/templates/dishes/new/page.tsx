import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DishTemplateForm } from "../../_forms";
import { upsertDishTemplateAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewDishTemplatePage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);

  return (
    <AdminShell
      session={session}
      title="New dish template"
      description="Create a reusable dish template for meal plans and seller menu builders."
      actions={<Button asChild variant="secondary"><Link href="/admin/templates/dishes">Back</Link></Button>}
    >
      <Card>
        <DishTemplateForm action={upsertDishTemplateAction} />
      </Card>
    </AdminShell>
  );
}
