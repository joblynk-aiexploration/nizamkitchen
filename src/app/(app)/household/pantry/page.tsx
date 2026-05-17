import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canAccessFamilyProfiles, listPantryItems } from "@/server/household";
import { addPantryItemAction, deletePantryItemAction, updatePantryItemAction } from "../actions";
import { ComingSoonFamilyProfiles, HouseholdNav, NonHouseholdState } from "../_components";

export const dynamic = "force-dynamic";

export default async function HouseholdPantryPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const { message } = await searchParams;
  const org = session.activeOrganization;
  const enabled = await canAccessFamilyProfiles({ organizationId: org.id, platformRole: session.user.platformRole });
  if (!enabled) return <ComingSoonFamilyProfiles />;
  if (org.organizationType !== "household") return <NonHouseholdState organizationType={org.organizationType} />;

  const [items, ingredients, units] = await Promise.all([
    listPantryItems(org.id),
    prisma.ingredient.findMany({ where: { isActive: true, OR: [{ organizationId: org.id }, { organizationId: null }] }, orderBy: { name: "asc" }, take: 200 }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Household" title="Pantry placeholder" description="Track pantry items now so grocery planning can safely subtract pantry stock in a future phase." />
      <HouseholdNav />
      <FormMessage message={message} />
      <Card>
        <form action={addPantryItemAction} className="grid gap-4 md:grid-cols-[1fr_120px_160px_160px_auto]">
          <select name="ingredientId" required className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
            <option value="">Choose ingredient</option>
            {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
          </select>
          <input name="quantity" type="number" min="0" step="0.01" placeholder="Qty" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <select name="unitId" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
            <option value="">Unit</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          <input name="expiresAt" type="date" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <Button type="submit">Add</Button>
          <input name="notes" placeholder="Notes (optional)" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm md:col-span-5" />
        </form>
      </Card>
      <div className="space-y-3">
        {items.length === 0 ? <Card><p className="text-sm text-[var(--color-muted)]">No pantry items yet.</p></Card> : items.map((item) => (
          <Card key={item.id} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold">{item.ingredient.name}</h2>
                <p className="text-sm text-[var(--color-muted)]">{item.quantity ?? ""} {item.unit?.name ?? ""} {item.notes ?? ""}</p>
                {item.expiresAt ? <p className="mt-1 text-xs text-[var(--color-muted)]">Expires {item.expiresAt.toLocaleDateString()}</p> : null}
              </div>
              <form action={deletePantryItemAction}>
                <input type="hidden" name="pantryItemId" value={item.id} />
                <Button type="submit" variant="ghost">Remove</Button>
              </form>
            </div>
            <form action={updatePantryItemAction} className="grid gap-3 rounded-2xl bg-slate-50 p-3 md:grid-cols-[1fr_110px_150px_150px_auto]">
              <input type="hidden" name="pantryItemId" value={item.id} />
              <select name="ingredientId" defaultValue={item.ingredientId} required className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
              </select>
              <input name="quantity" type="number" min="0" step="0.01" defaultValue={item.quantity?.toString() ?? ""} placeholder="Qty" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <select name="unitId" defaultValue={item.unitId ?? ""} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                <option value="">Unit</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
              <input name="expiresAt" type="date" defaultValue={item.expiresAt?.toISOString().slice(0, 10) ?? ""} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <Button type="submit" variant="secondary">Update</Button>
              <input name="notes" defaultValue={item.notes ?? ""} placeholder="Notes (optional)" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm md:col-span-5" />
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
