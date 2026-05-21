import Link from "next/link";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { DocumentUploadField } from "@/components/storage/file-upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { listRecipes } from "@/server/recipes";
import { canAccessMealPlanner, listMealPlans } from "@/server/meal-plans";
import { canAccessHomeChefs, isHouseholdRequestOrganization } from "@/server/home-chef";
import { getGoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import { createHomeChefRequestAction } from "../actions";

export const dynamic = "force-dynamic";

const requestTypeOptions = [
  { value: "custom", label: "Custom request" },
  { value: "recipe", label: "Recipe" },
  { value: "meal_plan", label: "Meal plan" },
  { value: "occasion", label: "Occasion" },
  { value: "weekly_cooking", label: "Weekly cooking" },
  { value: "daily_cooking", label: "Daily cooking" },
];

const genderOptions = [
  { value: "no_preference", label: "No preference" },
  { value: "female_preferred", label: "Female preferred" },
  { value: "male_preferred", label: "Male preferred" },
];

function tomorrowDateInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function NewHomeChefRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; recipeId?: string; mealPlanId?: string }>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const enabled = await canAccessHomeChefs({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled || !isHouseholdRequestOrganization(session.activeOrganization.organizationType)) {
    return (
      <EmptyState
        title="Home chef requests unavailable"
        description="This manual request flow is available only for enabled household organizations."
      />
    );
  }

  const mealPlannerEnabled = await canAccessMealPlanner({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  const [recipes, mealPlans, mapsConfig] = await Promise.all([
    listRecipes({
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      publishedOnly: true,
    }),
    mealPlannerEnabled ? listMealPlans(session.activeOrganization.id) : Promise.resolve([]),
    getGoogleMapsPublicConfig(session.activeOrganization.countryCode),
  ]);

  const type = requestTypeOptions.some((option) => option.value === params.type) ? params.type : "custom";
  const selectedRecipe = recipes.find((recipe) => recipe.id === params.recipeId);
  const selectedMealPlan = mealPlans.find((plan) => plan.id === params.mealPlanId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Manual request"
        title="Request a home chef"
        description="Send a structured request to NizamKitchen support. This is not automated booking, marketplace matching, or payment collection."
        actions={
          <Button asChild variant="secondary">
            <Link href="/home-chef/requests">View requests</Link>
          </Button>
        }
      />

      <form action={createHomeChefRequestAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="space-y-5">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Request details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectInput
                label="Request type"
                name="requestType"
                defaultValue={type}
                options={requestTypeOptions}
              />
              <TextInput
                label="Title"
                name="title"
                defaultValue={
                  selectedRecipe
                    ? `Chef for ${selectedRecipe.name}`
                    : selectedMealPlan
                      ? `Chef for ${selectedMealPlan.name}`
                      : ""
                }
                placeholder="Sunday family dinner"
                required
              />
              <SelectInput
                label="Recipe"
                name="recipeId"
                defaultValue={params.recipeId ?? ""}
                options={[
                  { value: "", label: "No linked recipe" },
                  ...recipes.map((recipe) => ({ value: recipe.id, label: recipe.name })),
                ]}
              />
              <SelectInput
                label="Meal plan"
                name="mealPlanId"
                defaultValue={params.mealPlanId ?? ""}
                options={[
                  { value: "", label: "No linked meal plan" },
                  ...mealPlans.map((plan) => ({ value: plan.id, label: plan.name })),
                ]}
              />
              <TextInput label="Requested date" name="requestedDate" type="date" defaultValue={tomorrowDateInput()} required />
              <TextInput label="Time window" name="requestedTimeWindow" placeholder="4 PM - 8 PM" />
              <TextInput label="Guest count" name="guestCount" type="number" min={1} defaultValue={4} required />
              <TextInput label="Household size" name="householdSize" type="number" min={1} defaultValue={4} />
            </div>
            <TextArea
              label="Description"
              name="description"
              placeholder="Describe the occasion, dishes, timing, or household needs."
            />
          </Card>

          <Card className="space-y-5">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Service details</h2>
            <div className="space-y-4">
              <LocationPicker
                label="Service location"
                mapsConfig={mapsConfig}
                hint="Google autocomplete helps fill the address when configured. Manual entry always stays available."
                fieldNames={{
                  addressLine1: "serviceAddressLine1",
                  addressLine2: "serviceAddressLine2",
                  city: "city",
                  region: "region",
                  countryCode: "locationCountryCode",
                  postalCode: "postalCode",
                  latitude: "locationLatitude",
                  longitude: "locationLongitude",
                  providerPlaceId: "locationProviderPlaceId",
                }}
                defaultValue={{ countryCode: session.activeOrganization.countryCode }}
              />
              <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Phone" name="phone" />
              <TextInput label="Preferred language" name="preferredLanguage" placeholder="English, Urdu, Hindi" />
              <SelectInput label="Chef gender preference" name="genderPreference" options={genderOptions} />
              <TextInput label="Budget amount" name="budgetAmount" type="number" min={0} step="0.01" />
              <TextInput
                label="Budget currency"
                name="budgetCurrency"
                defaultValue={session.activeOrganization.currencyCode}
                maxLength={3}
              />
              </div>
            </div>
            <TextArea label="Notes" name="notes" placeholder="Anything support should know before reviewing this request." />
            <DocumentUploadField
              label="Reference attachment"
              name="orderAttachmentFileId"
              module="orders"
              purpose="order_attachment"
              visibility="organization"
              entityType="home_chef_request"
              hint="Optional: upload a reference image, document, or planning file to S3 for support review."
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Submit request</h2>
            <p className="text-sm leading-6 text-[var(--color-muted)]">
              Save a draft if details are incomplete, or submit to send it to platform support for manual review.
            </p>
            <Button type="submit" name="intent" value="submit" className="w-full justify-center">
              Submit request
            </Button>
            <Button type="submit" name="intent" value="draft" variant="secondary" className="w-full justify-center">
              Save draft
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
}
