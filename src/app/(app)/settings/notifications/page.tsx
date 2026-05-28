import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { ensureEmailPreference } from "@/server/email/email-service";
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

const emailFields = [
  ["transactionalEnabled", "Transactional and security email", "Account, legal, payment, support, and security messages."],
  ["marketingEnabled", "Marketing email", "Promotions, referrals, credits, and optional campaign messages."],
  ["mealPlanningEmails", "Meal planning email", "Meal plan reminders and weekly planning messages."],
  ["groceryEmails", "Grocery email", "Grocery list sharing, reminders, and checklist messages."],
  ["orderEmails", "Order email", "Order submissions, status changes, pickup, delivery, and messages."],
  ["homeChefEmails", "Home chef email", "Home chef request, quote, assignment, and schedule messages."],
  ["sellerEmails", "Seller email", "Catering, restaurant, menu, order, and profile messages."],
  ["paymentEmails", "Payment and billing email", "Payments, invoices, receipts, refunds, subscriptions, and payouts."],
  ["verificationEmails", "Verification email", "Seller verification, KYC, documents, and safety review messages."],
  ["supportEmails", "Support email", "Support ticket creation, replies, and status changes."],
  ["reviewEmails", "Review email", "Review requests, reports, and moderation updates."],
  ["promotionEmails", "Promotion email", "Promotion, credit, referral, and loyalty messages."],
  ["adminAlertEmails", "Admin alert email", "Operational alerts for platform roles."],
] as const;

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireUser();
  const query = await searchParams;
  const [preferences, emailPreference] = await Promise.all([
    getNotificationPreference(session.user.id),
    ensureEmailPreference(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Notification preferences"
        description="Choose which operational updates NizamKitchen sends in-app and by email."
      />

      <FormMessage message={query.message} />

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">In-app and legacy email preferences</h2>
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
          <div className="pt-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Enterprise email categories</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              These preferences are respected by the enterprise email service. Important transactional messages may still be sent for account safety or legal/payment reasons.
            </p>
          </div>
          {emailFields.map(([name, label, description]) => (
            <label key={name} className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] p-4">
              <input
                type="checkbox"
                name={name}
                defaultChecked={emailPreference[name]}
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
