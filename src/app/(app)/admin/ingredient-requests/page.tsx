import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { listIngredientRequests } from "@/server/recipes";

export const dynamic = "force-dynamic";

async function approveRequest(formData: FormData) {
  "use server";
  const { requirePlatformRole: getSession } = await import("@/lib/auth/session");
  const { approveIngredientRequest } = await import("@/server/recipes");
  const session = await getSession(["platform_owner", "platform_admin"]);
  await approveIngredientRequest({
    session,
    requestId: String(formData.get("requestId")),
    category: (formData.get("category") as never) || null,
  });
  revalidatePath("/admin/ingredient-requests");
  revalidatePath("/admin/ingredients");
}

async function rejectRequest(formData: FormData) {
  "use server";
  const { requirePlatformRole: getSession } = await import("@/lib/auth/session");
  const { rejectIngredientRequest } = await import("@/server/recipes");
  const session = await getSession(["platform_owner", "platform_admin"]);
  await rejectIngredientRequest({
    session,
    requestId: String(formData.get("requestId")),
  });
  revalidatePath("/admin/ingredient-requests");
}

export default async function AdminIngredientRequestsPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "country_manager",
    "auditor",
  ]);
  const requests = await listIngredientRequests();
  const canReview = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Ingredient requests"
      description="Household and workspace requests for missing canonical ingredients."
    >
      <AdminDataTable
        data={requests}
        emptyMessage="No ingredient requests yet."
        columns={[
          {
            key: "requestedName",
            header: "Requested ingredient",
            render: (request) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{request.requestedName}</p>
                <p className="text-xs text-[var(--color-muted)]">Organization: {request.organizationId}</p>
              </div>
            ),
          },
          {
            key: "category",
            header: "Suggested category",
            render: (request) => request.suggestedCategory ? <Badge tone="neutral">{request.suggestedCategory}</Badge> : "Not provided",
          },
          {
            key: "notes",
            header: "Notes",
            render: (request) => request.notes ?? "No notes",
          },
          {
            key: "status",
            header: "Status",
            render: (request) => (
              <Badge tone={request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "warning"}>
                {request.status}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "Review",
            render: (request) => request.status === "pending" && canReview ? (
              <div className="flex flex-wrap gap-2">
                <form action={approveRequest} className="flex gap-2">
                  <input type="hidden" name="requestId" value={request.id} />
                  <select
                    name="category"
                    defaultValue={request.suggestedCategory ?? "other"}
                    className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs"
                  >
                    <option value="vegetable">Vegetable</option>
                    <option value="fruit">Fruit</option>
                    <option value="meat">Meat</option>
                    <option value="poultry">Poultry</option>
                    <option value="seafood">Seafood</option>
                    <option value="dairy">Dairy</option>
                    <option value="grain">Grain</option>
                    <option value="lentil">Lentil</option>
                    <option value="spice">Spice</option>
                    <option value="herb">Herb</option>
                    <option value="oil">Oil</option>
                    <option value="condiment">Condiment</option>
                    <option value="nut">Nut</option>
                    <option value="sweetener">Sweetener</option>
                    <option value="beverage">Beverage</option>
                    <option value="packaged">Packaged</option>
                    <option value="other">Other</option>
                  </select>
                  <Button type="submit" variant="success" className="min-h-9 rounded-xl px-3 py-1 text-xs">
                    Approve
                  </Button>
                </form>
                <form action={rejectRequest}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button type="submit" variant="secondary" className="min-h-9 rounded-xl px-3 py-1 text-xs">
                    Reject
                  </Button>
                </form>
              </div>
            ) : request.status === "pending" ? (
              <span className="text-xs text-[var(--color-muted)]">Pending admin review</span>
            ) : request.createdIngredientId ? (
              <span className="text-xs text-[var(--color-muted)]">Ingredient created</span>
            ) : (
              <span className="text-xs text-[var(--color-muted)]">Reviewed</span>
            ),
          },
          {
            key: "createdAt",
            header: "Requested",
            render: (request) => request.createdAt.toLocaleDateString("en-US"),
          },
        ]}
      />
    </AdminShell>
  );
}
