import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { getGroceryList } from "@/server/grocery";

export const dynamic = "force-dynamic";

export default async function EditGroceryListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const orgId = session.activeOrganization.id;

  const list = await getGroceryList(id, orgId);
  if (!list) notFound();

  async function updateList(formData: FormData) {
    "use server";
    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { updateGroceryList } = await import("@/server/grocery");
      const { groceryListUpdateSchema } = await import("@/lib/validation/grocery");

      const sess = await getSession();
      const parsed = groceryListUpdateSchema.safeParse({
        name: formData.get("name") || undefined,
        status: formData.get("status") || undefined,
        notes: formData.get("notes") || null,
      });

      if (!parsed.success) {
        redirect(`/grocery-lists/${id}/edit?message=Please correct the grocery list details.`);
      }

      await updateGroceryList(id, sess.activeOrganization.id, sess.user.id, parsed.data);
      redirect(`/grocery-lists/${id}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/grocery-lists/${id}/edit?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update grocery list."))}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Grocery Engine"
        title="Edit grocery list"
        description="Update the name, status, or notes for this grocery list."
      />

      <Card>
        <form action={updateList} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="name">
                List name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={list.name}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={list.status}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="notes">
                Notes
              </label>
              <input
                id="notes"
                name="notes"
                type="text"
                defaultValue={list.notes ?? ""}
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white"
            >
              Save changes
            </button>
            <Link
              href={`/grocery-lists/${list.id}`}
              className="rounded-2xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
