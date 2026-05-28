import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { getGroceryList } from "@/server/grocery";

export const dynamic = "force-dynamic";

export default async function ShoppingModePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hideCompleted?: string }>;
}) {
  const session = await requireMembership();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const list = await getGroceryList(id, session.activeOrganization.id);
  if (!list) notFound();

  const hideCompleted = query.hideCompleted === "true";
  const completedCount = list.items.filter((item) => item.isChecked).length;
  const totalCount = list.items.length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const itemsByCategory = new Map<string, typeof list.items>();
  for (const item of list.items) {
    if (hideCompleted && item.isChecked) continue;
    const group = itemsByCategory.get(item.category) ?? [];
    group.push(item);
    itemsByCategory.set(item.category, group);
  }

  async function toggleItem(formData: FormData) {
    "use server";
    const listId = formData.get("listId") as string;

    try {
      const { requireMembership: getSession } = await import("@/lib/auth/session");
      const { updateGroceryItem: update } = await import("@/server/grocery");
      const { revalidatePath } = await import("next/cache");
      const sess = await getSession();
      const itemId = formData.get("itemId") as string;
      const isChecked = formData.get("isChecked") === "true";
      await update(itemId, listId, sess.activeOrganization.id, sess.user.id, { isChecked: !isChecked });
      revalidatePath(`/grocery-lists/${listId}/shopping`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/grocery-lists/${listId}/shopping?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update grocery item."))}`);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 pb-28">
      <div className="sticky top-0 z-10 -mx-5 border-b border-[var(--color-border)] bg-[var(--color-app-surface)]/95 px-5 py-4 backdrop-blur sm:mx-0 sm:rounded-b-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Shopping Mode</p>
            <h1 className="font-serif text-2xl font-semibold leading-tight text-[var(--color-ink)] sm:text-4xl">{list.name}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{completedCount} of {totalCount} checked · {progress}% complete</p>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/grocery-lists/${list.id}`}>Exit</Link>
          </Button>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3">
          <Link
            href={`/grocery-lists/${list.id}/shopping${hideCompleted ? "" : "?hideCompleted=true"}`}
            className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold"
          >
            {hideCompleted ? "Show completed" : "Hide completed"}
          </Link>
        </div>
      </div>

      {itemsByCategory.size === 0 ? (
        <Card>
          <p className="text-base text-[var(--color-muted)]">Everything visible is checked off. Nice work.</p>
        </Card>
      ) : (
        Array.from(itemsByCategory.entries()).map(([category, items]) => (
          <Card key={category}>
            <h2 className="text-xl font-semibold capitalize text-[var(--color-ink)]">{category}</h2>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-4 ${item.isChecked ? "border-slate-200 bg-slate-50 opacity-70" : "border-[var(--color-border)] bg-white"}`}
                >
                  <div className="flex items-center gap-4">
                    <form action={toggleItem}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="listId" value={list.id} />
                      <input type="hidden" name="isChecked" value={String(item.isChecked)} />
                      <button
                        type="submit"
                        aria-label={item.isChecked ? `Mark ${item.canonicalIngredientName} as pending` : `Mark ${item.canonicalIngredientName} as complete`}
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[var(--color-border)] bg-white text-lg font-bold text-[var(--color-primary)]"
                      >
                        {item.isChecked ? "✓" : ""}
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xl font-semibold text-[var(--color-ink)] ${item.isChecked ? "line-through" : ""}`}>
                        {item.canonicalIngredientName}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--color-primary)]">{item.displayQuantity} {item.displayUnit}</p>
                      {item.sources[0] ? (
                        <p className="mt-1 text-sm text-[var(--color-muted)]">From {item.sources[0].recipeNameSnapshot}</p>
                      ) : null}
                    </div>
                    <Badge tone={item.isChecked ? "success" : "neutral"}>{item.isChecked ? "Done" : "Need"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </main>
  );
}
