import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getPublicChefProfile } from "@/server/chefs";
import { requestSpecificChefAction } from "../../actions";

export const dynamic = "force-dynamic";

const requestTypeOptions = [
  { value: "custom", label: "Custom request" },
  { value: "weekly_cooking", label: "Weekly cooking" },
  { value: "daily_cooking", label: "Daily cooking" },
  { value: "occasion", label: "Occasion cooking" },
  { value: "recipe", label: "Recipe specific" },
];

function tomorrowDateInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function RequestChefPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireMembership();
  const { slug } = await params;
  const enabled = await canAccessChefMarketplace({ organizationId: session.activeOrganization.id, platformRole: session.user.platformRole });
  if (!enabled) notFound();
  const chef = await getPublicChefProfile(slug, session.activeOrganization.id);
  if (!chef) notFound();

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
            <SelectInput label="Request type" name="requestType" options={requestTypeOptions} />
            <TextInput label="Title" name="title" defaultValue={`Request ${chef.displayName}`} required />
            <TextInput label="Requested date" name="requestedDate" type="date" defaultValue={tomorrowDateInput()} required />
            <TextInput label="Time window" name="requestedTimeWindow" placeholder="4 PM - 8 PM" />
            <TextInput label="Guest count" name="guestCount" type="number" min={1} defaultValue={4} required />
            <TextInput label="Household size" name="householdSize" type="number" min={1} defaultValue={4} />
            <TextInput label="Phone" name="phone" />
            <TextInput label="Preferred language" name="preferredLanguage" />
            <TextInput label="City" name="city" />
            <TextInput label="Region" name="region" />
            <TextInput label="Budget amount" name="budgetAmount" type="number" min={0} step="0.01" />
            <TextInput label="Budget currency" name="budgetCurrency" defaultValue={session.activeOrganization.currencyCode} maxLength={3} />
          </div>
          <TextArea label="Description" name="description" placeholder="What would you like this chef to help with?" />
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
