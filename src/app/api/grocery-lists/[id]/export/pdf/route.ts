import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getGroceryList } from "@/server/grocery";
import { groceryListToPdf, recordGroceryListExport } from "@/server/grocery-partners";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireMembership();
  const { id } = await params;
  const list = await getGroceryList(id, session.activeOrganization.id);
  if (!list) notFound();

  await recordGroceryListExport({
    groceryListId: list.id,
    organizationId: session.activeOrganization.id,
    createdById: session.user.id,
    exportType: "pdf",
  });

  return new Response(groceryListToPdf(list), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${list.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-grocery-list.pdf"`,
    },
  });
}
