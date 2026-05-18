import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getNotificationPreference } from "@/server/notifications/notification-service";
import { updateNotificationPreferenceAction } from "./actions";

export const dynamic = "force-dynamic";

const fields = [
  ["emailEnabled", "Email notifications", "Send operational emails when the provider is configured."],
  ["inAppEnabled", "In-app notifications", "Show notifications in the NizamKitchen inbox."],
  ["homeChefUpdates", "Home chef updates", "Request submission, assignment, and status changes."],
  ["chefRequestMessages", "Chef request messages", "New household/admin messages on chef requests."],
  ["groceryReminders", "Grocery reminders", "Grocery list sharing and future reminder workflows."],
  ["mealPlanReminders", "Meal plan reminders", "Future meal-plan reminders and weekly planning nudges."],
  ["adminAlerts", "Admin alerts", "Operational alerts for platform admins and support."],
  ["marketingEmails", "Marketing emails", "Promotional emails. Disabled by default."],
] as const;

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireUser();
  const query = await searchParams;
  const preferences = await getNotificationPreference(session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Notification preferences"
        description="Choose which operational updates NizamKitchen sends in-app and by email."
      />

      {query.message && <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card>}

      <Card>
        <form action={updateNotificationPreferenceAction} className="space-y-4">
          {fields.map(([name, label, description]) => (
            <label key={name} className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] p-4">
              <input
                type="checkbox"
                name={name}
                defaultChecked={preferences[name]}
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-[var(--color-ink)]">{label}</span>
                <span className="mt-1 block text-sm text-[var(--color-muted)]">{description}</span>
              </span>
            </label>
          ))}
          <Button type="submit">Save preferences</Button>
        </form>
      </Card>
    </div>
  );
}
