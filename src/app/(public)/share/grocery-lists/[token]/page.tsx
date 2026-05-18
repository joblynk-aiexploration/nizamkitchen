import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSharedGroceryList } from "@/server/grocery-partners";

export const dynamic = "force-dynamic";

export default async function SharedGroceryListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await getSharedGroceryList(token);
  if (!share) notFound();

  const list = share.groceryList;
  const grouped = new Map<string, typeof list.items>();
  for (const item of list.items) {
    const group = grouped.get(item.category) ?? [];
    group.push(item);
    grouped.set(item.category, group);
  }

  return (
    <main className="min-h-screen bg-[#f3f7f6] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">NizamKitchen shared list</p>
          <h1 className="mt-3 text-3xl font-semibold">{list.name}</h1>
          <p className="mt-2 text-sm text-slate-300">
            Read-only grocery list · {list.items.length} items · Shared {share.createdAt.toLocaleDateString()}
          </p>
        </div>

        {list.recipes.length > 0 && (
          <Card>
            <h2 className="text-base font-semibold">Recipe sources</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {list.recipes.map((recipe) => (
                <Badge key={recipe.id} tone="info">{recipe.recipeNameSnapshot}</Badge>
              ))}
            </div>
          </Card>
        )}

        {Array.from(grouped.entries()).map(([category, items]) => (
          <Card key={category}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{category}</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{item.canonicalIngredientName}</p>
                    {item.sources.length > 0 && (
                      <p className="text-xs text-slate-500">
                        From {Array.from(new Set(item.sources.map((source) => source.recipeNameSnapshot))).join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="whitespace-nowrap text-sm font-semibold text-emerald-700">
                    {item.displayQuantity} {item.displayUnit}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <p className="text-center text-xs text-slate-500">
          This link is read-only. It cannot edit the grocery list or reveal account details.
        </p>
      </div>
    </main>
  );
}
