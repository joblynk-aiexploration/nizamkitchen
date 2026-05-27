import Link from "next/link";
import { notFound } from "next/navigation";
import { FoodRequestFields } from "@/components/home-chef/food-request-fields";
import { RequestScheduleFields } from "@/components/home-chef/request-schedule-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getPublicChefProfile } from "@/server/chefs";
import { listEnabledCountryPhoneOptions, listEnabledLanguageOptions } from "@/server/localization/localization-service";
import { listRecipes } from "@/server/recipes";
import { requestSpecificChefAction } from "../../actions";

export const dynamic = "force-dynamic";

function tomorrowDateInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function RequestChefPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ recipeId?: string }>;
}) {
  const session = await requireMembership();
  const { slug } = await params;
  const query = await searchParams;
  const enabled = await canAccessChefMarketplace({ organizationId: session.activeOrganization.id, platformRole: session.user.platformRole });
  if (!enabled) notFound();
  const [chef, recipes, languageOptions, phoneOptions] = await Promise.all([
    getPublicChefProfile(slug, session.activeOrganization.id),
    listRecipes({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      publishedOnly: true,
    }),
    listEnabledLanguageOptions(),
    listEnabledCountryPhoneOptions(),
  ]);
  if (!chef) notFound();
  const selectedRecipe = recipes.find((recipe) => recipe.id === query.recipeId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef request"
        title={`Request ${chef.displayName}`}
        description="Send a manual request to support with this chef preselected. Scheduling and payments are not automated yet."
        actions={<Button asChild variant="secondary"><Link href={`/chefs/${chef.slug}`}>Back to profile</Link></Button>}
      />

      <form action={requestSpecificChefAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <input type="hidden" name="chefSlug" value={chef.slug} />
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Request details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FoodRequestFields recipes={recipes.map((recipe) => ({ id: recipe.id, name: recipe.name }))} defaultRecipeId={selectedRecipe?.id} />
            <RequestScheduleFields defaultDate={tomorrowDateInput()} />
            <TextInput label="Guest count" name="guestCount" type="number" min={1} defaultValue={4} required />
            <TextInput label="Household size" name="householdSize" type="number" min={1} defaultValue={4} />
            <PhoneNumberInput
              defaultCountryCode={phoneOptions.find((option) => option.countryCode === session.activeOrganization.countryCode)?.phoneCountryCode}
              options={phoneOptions}
            />
            <SelectInput
              label="Preferred language"
              name="preferredLanguage"
              options={[
                { value: "", label: "Select a language" },
                ...languageOptions.map((option) => ({ value: option.value, label: option.label })),
              ]}
            />
            <TextInput label="City" name="city" />
            <TextInput label="Region" name="region" />
            <TextInput label="Budget amount" name="budgetAmount" type="number" min={0} step="0.01" />
            <TextInput label="Budget currency" name="budgetCurrency" defaultValue={session.activeOrganization.currencyCode} maxLength={3} />
          </div>
          <TextArea label="Anything else the chef should know?" name="description" placeholder="Share timing, allergies, spice level, occasion details, or household needs." />
          <TextArea label="Notes" name="notes" placeholder="Dietary, timing, family, or support notes." />
        </Card>

        <Card className="h-fit space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Selected chef</h2>
          <p className="text-xl font-semibold text-[var(--color-primary)]">{chef.displayName}</p>
          <p className="text-sm text-[var(--color-muted)]">{chef.baseCity ?? "Service area TBD"}{chef.baseRegion ? `, ${chef.baseRegion}` : ""}</p>
          <Button type="submit" className="w-full justify-center">Submit request</Button>
        </Card>
      </form>
    </div>
  );
}
