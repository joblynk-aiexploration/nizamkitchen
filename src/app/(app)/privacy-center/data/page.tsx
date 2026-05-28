import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUserPrivacyCenterData } from "@/server/privacy/privacy-service";
import { cleanupUserPrivacyDataAction } from "../../privacy/actions";

export const dynamic = "force-dynamic";

export default async function PrivacyCenterDataPage() {
  const session = await requireMembership();
  const data = await getUserPrivacyCenterData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy center"
        title="Review my data"
        description="A user-scoped view of the profile, organization, marketplace, support, file, legal, and payment summary data connected to your account."
        actions={<Button asChild variant="secondary"><Link href="/privacy-center">Back</Link></Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Profile</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium text-[var(--color-ink)]">{data.user?.fullName ?? "Not set"}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium text-[var(--color-ink)]">{data.user?.email ?? "Not set"}</dd></div>
            <div><dt className="text-slate-500">Location</dt><dd className="font-medium text-[var(--color-ink)]">{data.user?.locationText ?? "Not set"}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Organizations</h2>
          <div className="mt-4 divide-y divide-[var(--color-border)] text-sm">
            {data.memberships.length === 0 ? <p className="text-[var(--color-muted)]">No organization memberships found.</p> : data.memberships.map((membership) => (
              <div key={membership.id} className="py-3">
                <p className="font-medium text-[var(--color-ink)]">{membership.organization.name}</p>
                <p className="text-[var(--color-muted)]">{membership.role} · {membership.organization.organizationType}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DataCount title="Meal plans" count={data.mealPlans.length} />
        <DataCount title="Grocery lists" count={data.groceryLists.length} />
        <DataCount title="Orders" count={data.foodOrders.length} />
        <DataCount title="Saved restaurants" count={data.savedRestaurants.length} />
        <DataCount title="Favorite recipes" count={data.favoriteRecipes.length} />
        <DataCount title="Support tickets" count={data.supportTickets.length} />
        <DataCount title="Notifications" count={data.notifications.length} />
        <DataCount title="Uploaded files" count={data.storageFiles.length} />
        <DataCount title="Legal acceptances" count={data.legalAcceptances.length} />
      </div>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Clean up allowed data</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          These controls remove convenience data only. Payment ledgers, audit logs, active orders, and required KYC/verification records stay protected.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <CleanupButton cleanupType="saved_restaurants" label="Delete saved restaurants" />
          <CleanupButton cleanupType="favorite_recipes" label="Remove favorites" />
          <CleanupButton cleanupType="old_grocery_lists" label="Archive old grocery lists" />
          <CleanupButton cleanupType="old_meal_plans" label="Archive old meal plans" />
        </div>
      </Card>
    </div>
  );
}

function DataCount({ title, count }: { title: string; count: number }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{count}</p>
    </Card>
  );
}

function CleanupButton({ cleanupType, label }: { cleanupType: string; label: string }) {
  return (
    <form action={cleanupUserPrivacyDataAction}>
      <input type="hidden" name="cleanupType" value={cleanupType} />
      <Button type="submit" variant="secondary">{label}</Button>
    </form>
  );
}
