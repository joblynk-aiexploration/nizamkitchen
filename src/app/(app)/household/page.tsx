import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { titleCase } from "@/lib/utils";
import { canAccessFamilyProfiles, getHouseholdOverview } from "@/server/household";
import { ComingSoonFamilyProfiles, HouseholdNav, NonHouseholdState } from "./_components";

export const dynamic = "force-dynamic";

export default async function HouseholdPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const { message } = await searchParams;
  const org = session.activeOrganization;
  const enabled = await canAccessFamilyProfiles({ organizationId: org.id, platformRole: session.user.platformRole });

  if (!enabled) return <ComingSoonFamilyProfiles />;
  if (org.organizationType !== "household") return <NonHouseholdState organizationType={org.organizationType} />;

  const { profile, avoidedIngredients, favorites, pantryItems, preferredCuisines, shoppingPreference, members } = await getHouseholdOverview(org.id);
  const setupItems = [
    { label: "Household profile", complete: Boolean(profile), href: "/household/preferences" },
    { label: "Family members", complete: members.length > 1, href: "/household/members" },
    { label: "Cuisine preferences", complete: preferredCuisines.length > 0, href: "/household/preferences" },
    { label: "Food restrictions", complete: avoidedIngredients.length > 0, href: "/household/avoided-ingredients" },
    { label: "Shopping preferences", complete: Boolean(shoppingPreference), href: "/household/shopping-preferences" },
  ];
  const setupComplete = setupItems.filter((item) => item.complete).length;
  const setupPercent = Math.round((setupComplete / setupItems.length) * 100);
  const mealPlanReady = Boolean(profile?.defaultServings && preferredCuisines.length > 0);
  const shoppingMethod = shoppingPreference?.preferredDeliveryMethod
    ? titleCase(shoppingPreference.preferredDeliveryMethod)
    : "Not selected";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Household"
        title={profile?.displayName ?? org.name}
        description="Manage your family profile, shared recipes, preferences, pantry notes, and shopping defaults from one place."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link href="/household/members">Family members</Link></Button>
            <Button asChild><Link href="/household/preferences">{profile ? "Edit household" : "Set up household"}</Link></Button>
          </div>
        }
      />
      <HouseholdNav />
      <FormMessage message={message} />

      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-[linear-gradient(135deg,#063b3b,#0f766e)] p-6 text-white md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Family command center</p>
            <h2 className="mt-4 font-serif text-3xl font-semibold md:text-4xl">
              Plan meals around the people actually eating them.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">
              Your household settings help NizamKitchen scale recipes, warn about ingredients, build grocery lists, and keep family members working from the same kitchen plan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="bg-white text-[#063b3b] hover:bg-emerald-50">
                <Link href="/meal-plans/new">Create meal plan</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/50 text-white hover:bg-white/10">
                <Link href="/recipes/new">Add family recipe</Link>
              </Button>
            </div>
          </div>
          <div className="bg-white p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Setup progress</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{setupPercent}%</p>
              </div>
              <Badge tone={setupPercent === 100 ? "success" : "info"}>{setupComplete} of {setupItems.length} done</Badge>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${setupPercent}%` }} />
            </div>
            <div className="mt-5 space-y-3">
              {setupItems.map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm transition hover:bg-slate-50">
                  <span className="font-medium text-[var(--color-ink)]">{item.label}</span>
                  <Badge tone={item.complete ? "success" : "neutral"}>{item.complete ? "Complete" : "Add"}</Badge>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Family size</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{profile?.defaultHouseholdSize ?? "Unset"}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {profile?.adultsCount ?? 0} adults, {profile?.childrenCount ?? 0} children
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Default servings</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{profile?.defaultServings ?? "Unset"}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{mealPlanReady ? "Ready for meal planning" : "Add cuisines to improve planning"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Taste profile</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{profile?.defaultSpiceLevel ? titleCase(profile.defaultSpiceLevel) : "Unset"}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{profile?.cookingSkillLevel ? `${titleCase(profile.cookingSkillLevel)} cooking skill` : "Cooking skill not set"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Family access</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{members.length}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">active household login{members.length === 1 ? "" : "s"}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meal intelligence</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-[var(--color-ink)]">Food preferences and safety</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">These details help recipes, meal plans, and grocery lists fit your household.</p>
            </div>
            <Button asChild variant="secondary"><Link href="/household/preferences">Update preferences</Link></Button>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
              <h3 className="font-semibold text-[var(--color-ink)]">Preferred cuisines</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {preferredCuisines.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No preferred cuisines yet.</p> : preferredCuisines.map((item) => (
                  <Badge key={item.id} tone="info">{item.cuisine.name}</Badge>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
              <h3 className="font-semibold text-[var(--color-ink)]">Ingredient alerts</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {avoidedIngredients.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No avoided ingredients yet.</p> : avoidedIngredients.slice(0, 8).map((item) => (
                  <Badge key={item.id} tone={item.severity === "strict" ? "danger" : "warning"}>{item.ingredientName}</Badge>
                ))}
              </div>
              {avoidedIngredients.length > 8 ? <p className="mt-3 text-xs text-[var(--color-muted)]">+{avoidedIngredients.length - 8} more saved alerts</p> : null}
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick actions</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-[var(--color-ink)]">Keep things moving</h2>
          <div className="mt-5 grid gap-3">
            <Button asChild className="justify-start"><Link href="/household/members">Manage family members</Link></Button>
            <Button asChild variant="secondary" className="justify-start"><Link href="/household/favorites">Open favorite recipes ({favorites.length})</Link></Button>
            <Button asChild variant="secondary" className="justify-start"><Link href="/household/pantry">Review pantry ({pantryItems.length})</Link></Button>
            <Button asChild variant="secondary" className="justify-start"><Link href="/household/shopping-preferences">Shopping preferences</Link></Button>
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
            <h3 className="font-semibold text-[var(--color-ink)]">Shopping default</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {shoppingPreference?.preferredStoreName ?? "No preferred store saved"} - {shoppingMethod}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
