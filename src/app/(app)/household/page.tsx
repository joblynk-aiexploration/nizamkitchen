import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
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

  const { profile, avoidedIngredients, favorites, pantryItems } = await getHouseholdOverview(org.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Household"
        title={profile?.displayName ?? org.name}
        description="Keep the family defaults that help meal plans, grocery lists, and recipe warnings match real household needs."
        actions={<Button asChild><Link href="/household/preferences">{profile ? "Edit profile" : "Create profile"}</Link></Button>}
      />
      <HouseholdNav />
      <FormMessage message={message} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs text-[var(--color-muted)]">Household size</p><p className="mt-2 text-2xl font-semibold">{profile?.defaultHouseholdSize ?? "Unset"}</p></Card>
        <Card><p className="text-xs text-[var(--color-muted)]">Default servings</p><p className="mt-2 text-2xl font-semibold">{profile?.defaultServings ?? "Unset"}</p></Card>
        <Card><p className="text-xs text-[var(--color-muted)]">Spice</p><p className="mt-2 text-2xl font-semibold">{profile?.defaultSpiceLevel ?? "Unset"}</p></Card>
        <Card><p className="text-xs text-[var(--color-muted)]">Skill</p><p className="mt-2 text-2xl font-semibold">{profile?.cookingSkillLevel ?? "Unset"}</p></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <h2 className="font-semibold">Avoided ingredients</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {avoidedIngredients.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No avoided ingredients yet.</p> : avoidedIngredients.slice(0, 8).map((item) => (
              <Badge key={item.id} tone={item.severity === "strict" ? "danger" : "warning"}>{item.ingredientName}</Badge>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Favorite recipes</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">{favorites.length} saved recipe{favorites.length === 1 ? "" : "s"}</p>
          <Link href="/household/favorites" className="mt-3 inline-block text-sm font-semibold text-[var(--color-primary)]">Open favorites</Link>
        </Card>
        <Card>
          <h2 className="font-semibold">Pantry placeholder</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">{pantryItems.length} pantry item{pantryItems.length === 1 ? "" : "s"} tracked for future grocery planning.</p>
        </Card>
      </div>
    </div>
  );
}
