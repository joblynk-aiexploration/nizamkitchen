import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canAccessFamilyProfiles, listAvoidedIngredients } from "@/server/household";
import { addAvoidedIngredientAction, deleteAvoidedIngredientAction } from "../actions";
import { ComingSoonFamilyProfiles, HouseholdNav, NonHouseholdState } from "../_components";

export const dynamic = "force-dynamic";

export default async function AvoidedIngredientsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const { message } = await searchParams;
  const org = session.activeOrganization;
  const enabled = await canAccessFamilyProfiles({ organizationId: org.id, platformRole: session.user.platformRole });
  if (!enabled) return <ComingSoonFamilyProfiles />;
  if (org.organizationType !== "household") return <NonHouseholdState organizationType={org.organizationType} />;

  const [items, ingredients] = await Promise.all([
    listAvoidedIngredients(org.id),
    prisma.ingredient.findMany({ where: { isActive: true, OR: [{ organizationId: org.id }, { organizationId: null }] }, orderBy: { name: "asc" }, take: 200 }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Household" title="Avoided ingredients" description="Warn the household when a recipe includes something they prefer to avoid. This never blocks a recipe." />
      <HouseholdNav />
      <FormMessage message={message} />
      <Card>
        <form action={addAvoidedIngredientAction} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select name="ingredientId" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
            <option value="">Custom ingredient name</option>
            {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
          </select>
          <input name="ingredientName" required placeholder="Ingredient name" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <select name="severity" defaultValue="avoid" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
            <option value="preference">Preference</option><option value="avoid">Avoid</option><option value="strict">Strict</option>
          </select>
          <Button type="submit">Add</Button>
          <input name="reason" placeholder="Reason or note (optional)" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm md:col-span-4" />
        </form>
      </Card>
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2"><h2 className="font-semibold">{item.ingredientName}</h2><Badge tone={item.severity === "strict" ? "danger" : "warning"}>{item.severity}</Badge></div>
              {item.reason && <p className="mt-1 text-sm text-[var(--color-muted)]">{item.reason}</p>}
            </div>
            <form action={deleteAvoidedIngredientAction}>
              <input type="hidden" name="avoidedIngredientId" value={item.id} />
              <Button type="submit" variant="ghost">Remove</Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
