import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { ShareHouseholdRecipeForm } from "@/components/household/share-household-recipe-form";
import { PageHeader } from "@/components/ui/page-header";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { getTotalMinutes } from "@/lib/recipe-utils";
import {
  canAccessFamilyProfiles,
  listHouseholdMembers,
  listHouseholdSharedRecipes,
} from "@/server/household";
import { listRecipes } from "@/server/recipes";
import { createHouseholdMemberAction, shareHouseholdRecipeAction } from "../actions";
import { ComingSoonFamilyProfiles, HouseholdNav, NonHouseholdState } from "../_components";

export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  org_owner: "Household owner",
  org_admin: "Household admin",
  household_member: "Family member",
  member: "Member",
};

export default async function HouseholdMembersPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const { message } = await searchParams;
  const org = session.activeOrganization;
  const enabled = await canAccessFamilyProfiles({ organizationId: org.id, platformRole: session.user.platformRole });

  if (!enabled) return <ComingSoonFamilyProfiles />;
  if (org.organizationType !== "household") return <NonHouseholdState organizationType={org.organizationType} />;

  const [members, sharedRecipes, availableRecipes] = await Promise.all([
    listHouseholdMembers(org.id),
    listHouseholdSharedRecipes(org.id),
    listRecipes({
      organizationId: org.id,
      countryCode: org.countryCode,
      publishedOnly: true,
    }),
  ]);
  const canManageMembers = ["org_owner", "org_admin"].includes(session.activeMembership.role);
  const recipeOptions = availableRecipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    cuisineName: recipe.cuisine.name,
    servings: recipe.servings,
    servingUnit: recipe.servingUnit,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: getTotalMinutes(recipe),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Household"
        title="Family members"
        description="Create a login for your daughter, spouse, parent, or another family member so everyone can use the same household recipes and planning tools."
        actions={
          <Button asChild variant="secondary">
            <Link href="#share-recipe">Share a recipe</Link>
          </Button>
        }
      />
      <HouseholdNav />
      <FormMessage message={message} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Family access</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-[var(--color-ink)]">Create a family login</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Family members get their own sign-in, while shared household recipes stay connected to this household.
              </p>
            </div>
            <Badge tone={canManageMembers ? "success" : "neutral"}>{canManageMembers ? "Can manage" : "View only"}</Badge>
          </div>

          {canManageMembers ? (
            <form action={createHouseholdMemberAction} className="mt-6 space-y-4">
              <TextInput label="Family member name" name="fullName" required placeholder="e.g. Ayesha Nizam" />
              <TextInput label="Email address" name="email" type="email" required placeholder="daughter@example.com" />
              <TextInput
                label="Temporary password"
                name="password"
                type="password"
                required
                hint="Use at least 8 characters with uppercase, lowercase, and a number. They can change it later."
              />
              <Button type="submit" className="w-full">Create family member account</Button>
            </form>
          ) : (
            <p className="mt-6 rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
              Ask the household owner to add or update family member accounts.
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active members</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-[var(--color-ink)]">Who can use this household</h2>
            </div>
            <Badge tone="info">{members.length} active</Badge>
          </div>
          <div className="mt-6 divide-y divide-[var(--color-border)]">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{member.user.fullName}</p>
                  <p className="text-sm text-[var(--color-muted)]">{member.user.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={member.role === "org_owner" ? "success" : "neutral"}>
                    {roleLabels[member.role] ?? member.role.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-xs text-[var(--color-muted)]">{member.user.status.toLowerCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div id="share-recipe" className="scroll-mt-24">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Shared recipes</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-[var(--color-ink)]">Share recipes with your family</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Pick from the same recipes shown on your Recipes page. Enter your family serving count and we will show the recipe&apos;s prep and cook time automatically.
            </p>
          </div>
          <Button asChild>
            <Link href="/recipes/new">Create household recipe</Link>
          </Button>
        </div>

        {recipeOptions.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            No recipes are available to share yet. Add or publish a recipe first.
          </p>
        ) : (
          <div className="mt-6">
            <ShareHouseholdRecipeForm recipes={recipeOptions} action={shareHouseholdRecipeAction} />
          </div>
        )}

        <div className="mt-8">
          <h3 className="font-semibold text-[var(--color-ink)]">Already shared with this household</h3>
        </div>
        {sharedRecipes.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            No shared household recipes yet. Select a recipe above to share it with every active family member.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sharedRecipes.map((sharedRecipe) => (
              <Link
                key={sharedRecipe.id}
                href={`/recipes/${sharedRecipe.recipe.id}`}
                className="rounded-2xl border border-[var(--color-border)] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{sharedRecipe.recipe.cuisine.name}</p>
                    <h3 className="mt-2 font-semibold text-[var(--color-ink)]">{sharedRecipe.recipe.name}</h3>
                  </div>
                  <Badge tone="success">Shared</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-[var(--color-muted)]">{sharedRecipe.recipe.description ?? "No description yet."}</p>
                <p className="mt-3 text-xs font-semibold text-[var(--color-muted)]">
                  {sharedRecipe.targetServings ?? sharedRecipe.recipe.servings} serving{(sharedRecipe.targetServings ?? sharedRecipe.recipe.servings) === 1 ? "" : "s"} · Prep {sharedRecipe.recipe.prepMinutes} min · Cook {sharedRecipe.recipe.cookMinutes} min
                </p>
              </Link>
            ))}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
