import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getGroceryList } from "@/server/grocery";

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

  const itemsByCategory = new Map<string, typeof list.items>();
  for (const item of list.items) {
    const group = itemsByCategory.get(item.category) ?? [];
    group.push(item);
    itemsByCategory.set(item.category, group);
  }

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { font-size: 12pt; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 24px; }
        .category { margin-bottom: 20px; }
        .category-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
        .item { display: flex; align-items: flex-start; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
        .checkbox { width: 16px; height: 16px; border: 1px solid #cbd5e1; border-radius: 3px; flex-shrink: 0; margin-top: 2px; }
        .item-name { flex: 1; font-size: 0.95rem; }
        .item-qty { font-weight: 600; color: #0f172a; white-space: nowrap; }
        .item-note { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
        .warn { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 0.85rem; }
        .recipes { margin-bottom: 20px; }
        .recipe-tag { display: inline-block; background: #eff6ff; color: #1d4ed8; border-radius: 9999px; padding: 2px 10px; font-size: 0.75rem; margin-right: 6px; margin-bottom: 4px; }
        .btn { display: inline-block; padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; cursor: pointer; margin-right: 8px; margin-bottom: 20px; text-decoration: none; color: inherit; background: #f8fafc; }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('DOMContentLoaded',function(){var b=document.getElementById('print-btn');if(b)b.addEventListener('click',function(){window.print();});});` }} />

      <div className="no-print" style={{ marginBottom: 16 }}>
        <button id="print-btn" className="btn">Print</button>
        <a className="btn" href={`/grocery-lists/${id}`}>Back to list</a>
      </div>

      <h1>{list.name}</h1>
      <p className="meta">
        {list.recipes.length} recipe{list.recipes.length !== 1 ? "s" : ""}
        {" · "}
        {list.items.length} ingredient{list.items.length !== 1 ? "s" : ""}
        {" · "}
        Generated {list.createdAt.toLocaleDateString()}
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
    </>
  );
}
