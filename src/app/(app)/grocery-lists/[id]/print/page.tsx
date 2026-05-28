import { notFound } from "next/navigation";
import { PrintGroceryListActions } from "@/components/grocery/print-grocery-list-actions";
import { requireMembership } from "@/lib/auth/session";
import { getGroceryList } from "@/server/grocery";
import { recordGroceryListExport } from "@/server/grocery-partners";

export const dynamic = "force-dynamic";

export default async function PrintGroceryListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const list = await getGroceryList(id, session.activeOrganization.id);
  if (!list) notFound();
  await recordGroceryListExport({
    groceryListId: list.id,
    organizationId: session.activeOrganization.id,
    createdById: session.user.id,
    exportType: "print",
  });

  const itemsByCategory = new Map<string, typeof list.items>();
  for (const item of list.items) {
    const group = itemsByCategory.get(item.category) ?? [];
    group.push(item);
    itemsByCategory.set(item.category, group);
  }
  const generatedDate = (list.createdAt instanceof Date ? list.createdAt : new Date()).toLocaleDateString("en-US");

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { font-size: 12pt; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body aside { display: none !important; }
        body main { min-height: auto !important; padding: 0 !important; }
        body main > div { max-width: none !important; margin: 0 !important; }
        body { font-family: ui-serif, Georgia, serif; max-width: 860px; margin: 0 auto; padding: 28px; color: #0f172a; background: #f8fafc; }
        .sheet { background: white; border: 1px solid #dbe5ea; border-radius: 24px; padding: 32px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08); }
        .brand { color: #0f766e; font-size: 1rem; font-weight: 900; letter-spacing: 0.02em; }
        h1 { font-size: 1.9rem; font-weight: 800; margin: 8px 0 4px; }
        .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 24px; }
        .category { margin-bottom: 20px; }
        .category-title { font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #0f766e; border-bottom: 2px solid #ccfbf1; padding-bottom: 6px; margin-bottom: 8px; }
        .item { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .checkbox { width: 18px; height: 18px; border: 1.5px solid #94a3b8; border-radius: 4px; flex-shrink: 0; margin-top: 2px; }
        .item-name { flex: 1; font-size: 0.95rem; }
        .item-qty { font-weight: 600; color: #0f172a; white-space: nowrap; }
        .item-note { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
        .warn { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 0.85rem; }
        .recipes { margin-bottom: 20px; }
        .recipe-tag { display: inline-block; background: #eff6ff; color: #1d4ed8; border-radius: 9999px; padding: 2px 10px; font-size: 0.75rem; margin-right: 6px; margin-bottom: 4px; }
      `}</style>

      <PrintGroceryListActions listHref={`/grocery-lists/${id}`} />

      <section className="sheet">
        <p className="brand">NizamKitchen</p>
        <h1>{list.name}</h1>
        <p className="meta">
          {list.recipes.length} recipe{list.recipes.length !== 1 ? "s" : ""}
          {" · "}
          {list.items.length} ingredient{list.items.length !== 1 ? "s" : ""}
          {" · "}
          Generated {generatedDate}
        </p>

        {list.recipes.length > 0 && (
          <div className="recipes">
            {list.recipes.map((r) => (
              <span key={r.id} className="recipe-tag">
                {r.recipeNameSnapshot} ({r.targetServings} servings)
              </span>
            ))}
          </div>
        )}

        {list.warnings.length > 0 && (
          <div className="warn">
            <strong>Warnings ({list.warnings.length}):</strong>
            <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
              {list.warnings.map((w) => (
                <li key={w.id}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {Array.from(itemsByCategory.entries()).map(([category, items]) => (
          <div key={category} className="category">
            <p className="category-title">{category}</p>
            {items.map((item) => (
              <div key={item.id} className="item">
                <div className="checkbox" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="item-name">{item.canonicalIngredientName}</span>
                    <span className="item-qty">{item.displayQuantity} {item.displayUnit}</span>
                  </div>
                  {item.sources.length > 1 && (
                    <p className="item-note">
                      From: {item.sources.map((s) => s.recipeNameSnapshot).join(", ")}
                    </p>
                  )}
                  {item.notes && <p className="item-note">{item.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
