import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { ensureEmailPreference } from "@/server/email/email-service";
import { getNotificationPreference } from "@/server/notifications/notification-service";
import { updateNotificationPreferenceAction } from "./actions";
import { visibleEmailPreferenceFields, visibleNotificationPreferenceFields } from "./preference-fields";

export const dynamic = "force-dynamic";

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
  const visibilityContext = {
    platformRole: session.user.platformRole,
    organizationType: session.activeOrganization?.organizationType,
    membershipRole: session.activeMembership?.role,
  };
  const fields = visibleNotificationPreferenceFields(visibilityContext);
  const emailFields = visibleEmailPreferenceFields(visibilityContext);

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
