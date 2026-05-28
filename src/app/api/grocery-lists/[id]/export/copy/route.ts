import { requireMembership } from "@/lib/auth/session";
import { getGroceryList } from "@/server/grocery";
import { recordGroceryListExport } from "@/server/grocery-partners";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireMembership();
  const { id } = await params;
  const list = await getGroceryList(id, session.activeOrganization.id);
  if (!list) return Response.json({ ok: false }, { status: 404 });

  await recordGroceryListExport({
    groceryListId: list.id,
    organizationId: session.activeOrganization.id,
    createdById: session.user.id,
    exportType: "copy",
  });

  return Response.json({ ok: true });
}
