import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CopyGroceryListButton } from "@/components/grocery/copy-grocery-list-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { hasPlatformRole, PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { getGroceryList } from "@/server/grocery";
import { groceryListToClipboardText, listActiveGroceryPartners } from "@/server/grocery-partners";
import { confidenceBadgeProps, mergeBadgeProps } from "@/lib/grocery-display";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  draft: "neutral",
  active: "success",
  completed: "info",
  archived: "warning",
};

const SEVERITY_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  info: "info",
  warning: "warning",
  error: "danger",
};

export default async function GroceryListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const orgId = session.activeOrganization.id;

  const featureEnabled = await isFeatureEnabled("grocery_engine", orgId);
  if (!featureEnabled && !hasPlatformRole(session.user.platformRole, PLATFORM_ADMIN_ROLES)) {
    redirect("/grocery-lists");
  }

  const list = await getGroceryList(id, orgId);
  if (!list) notFound();
  const partners = await listActiveGroceryPartners(
    list.countryCode ?? session.activeOrganization.countryCode,
    orgId,
  );

  // Group items by category
  const itemsByCategory = new Map<string, typeof list.items>();
  for (const item of list.items) {
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
      const sess = await getSession();
      const itemId = formData.get("itemId") as string;
      const isChecked = formData.get("isChecked") === "true";
      await update(itemId, listId, sess.activeOrganization.id, sess.user.id, { isChecked: !isChecked });
      const { revalidatePath } = await import("next/cache");
      revalidatePath(`/grocery-lists/${listId}`);
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/grocery-lists/${listId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update grocery item."))}`);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Grocery Engine"
        title={list.name}
        description={`${list.recipes.length} recipe${list.recipes.length !== 1 ? "s" : ""} · ${list.items.length} ingredient${list.items.length !== 1 ? "s" : ""}`}
      />

      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={STATUS_TONE[list.status] ?? "neutral"}>{list.status}</Badge>
        <Link
          href={`/grocery-lists/${list.id}/edit`}
          className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
        >
          Edit
        </Link>
        <Link
          href={`/grocery-lists/${list.id}/shopping`}
          className="inline-flex min-h-11 items-center rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-strong)]"
        >
          Shopping Mode
        </Link>
        <Link
          href={`/grocery-lists/${list.id}/print`}
          className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
          target="_blank"
        >
          Print
        </Link>
        <a
          href={`/api/grocery-lists/${list.id}/export/pdf`}
          className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
        >
          Export PDF
        </a>
        <a
          href={`/api/grocery-lists/${list.id}/export/csv`}
          className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
        >
          Export CSV
        </a>
        <Link
          href={`/grocery-lists/${list.id}/share`}
          className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
        >
          Share link
        </Link>
        <Link
          href={`/grocery-lists/${list.id}/export`}
          className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-slate-50"
        >
          Partner options
        </Link>
        <Link
          href="/grocery-lists"
          className="ml-auto text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Back to lists
        </Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Shopping handoff</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Copy this list, export it, or use partner placeholders when available. No checkout or payment is connected.
            </p>
          </div>
          <CopyGroceryListButton listId={list.id} text={groceryListToClipboardText(list)} />
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
          {partners.length > 0
            ? `${partners.length} active grocery partner option${partners.length === 1 ? "" : "s"} available for ${list.countryCode ?? session.activeOrganization.countryCode}.`
            : "Grocery partner options are not enabled or configured for this country yet."}
        </div>
      </Card>

      {/* Recipes used */}
      {list.recipes.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Recipes included</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {list.recipes.map((r) => (
              <span
                key={r.id}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
              >
                {r.recipeNameSnapshot} ({r.targetServings} servings)
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Warnings panel */}
      {list.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-base font-semibold text-amber-900">
            Conversion warnings ({list.warnings.length})
          </h2>
          <div className="mt-4 space-y-3">
            {list.warnings.map((w) => (
              <div key={w.id} className="flex items-start gap-3 rounded-xl bg-white p-3">
                <Badge tone={SEVERITY_TONE[w.severity] ?? "neutral"}>{w.severity}</Badge>
                <div className="flex-1">
                  <p className="text-sm text-[var(--color-ink)]">{w.message}</p>
                  {w.sourceRecipeName && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">Recipe: {w.sourceRecipeName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Items grouped by category */}
      {itemsByCategory.size === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No items in this list.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(itemsByCategory.entries()).map(([category, items]) => (
            <Card key={category}>
              <h2 className="text-base font-semibold capitalize text-[var(--color-ink)]">{category}</h2>
              <div className="mt-4 space-y-3">
                {items.map((item) => {
                  const confProps = confidenceBadgeProps(item.confidence);
                  const mergeProps = mergeBadgeProps(item.mergeStatus);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        item.isChecked
                          ? "border-slate-200 bg-slate-50 opacity-60"
                          : "border-[var(--color-border)] bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <form action={toggleItem}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="listId" value={list.id} />
                          <input type="hidden" name="isChecked" value={String(item.isChecked)} />
                          <button
                            type="submit"
                            aria-label={item.isChecked
                              ? `Mark ${item.canonicalIngredientName} as pending`
                              : `Mark ${item.canonicalIngredientName} as complete`}
                            className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]"
                          >
                            {item.isChecked && (
                              <span className="text-lg font-bold leading-none text-[var(--color-primary)]" aria-hidden="true">✓</span>
                            )}
                          </button>
                        </form>

                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`font-medium text-[var(--color-ink)] ${item.isChecked ? "line-through" : ""}`}>
                              {item.canonicalIngredientName}
                            </span>
                            <span className="text-sm font-semibold text-[var(--color-primary)]">
                              {item.displayQuantity} {item.displayUnit}
                            </span>
                            <Badge tone={confProps.tone}>{confProps.label}</Badge>
                            {item.mergeStatus !== "separate" && (
                              <Badge tone={mergeProps.tone}>{mergeProps.label}</Badge>
                            )}
                          </div>

                          {/* Source recipes (expandable via details) */}
                          {item.sources.length > 1 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                                {item.sources.length} sources
                              </summary>
                              <div className="mt-2 space-y-1 pl-2">
                                {item.sources.map((src) => (
                                  <p key={src.id} className="text-xs text-[var(--color-muted)]">
                                    {src.recipeNameSnapshot}: {src.originalQuantity} {src.originalUnitNameSnapshot}
                                    {src.conversionApplied && ` → ${src.scaledQuantity.toFixed(2)} ${src.scaledUnitNameSnapshot}`}
                                    {src.warning && <span className="ml-1 text-amber-600">({src.warning})</span>}
                                  </p>
                                ))}
                              </div>
                            </details>
                          )}

                          {item.sources.length === 1 && (
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                              From: {item.sources[0].recipeNameSnapshot}
                            </p>
                          )}

                          {item.notes && (
                            <p className="mt-1 text-xs italic text-[var(--color-muted)]">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
