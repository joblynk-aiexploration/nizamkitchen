import type { OrganizationRole, OrganizationType, PlatformRole } from "@prisma/client";

export const notificationPreferenceFields = [
  ["emailEnabled", "Email notifications", "Send operational emails when the provider is configured.", ["all"]],
  ["inAppEnabled", "In-app notifications", "Show notifications in the NizamKitchen inbox.", ["all"]],
  ["homeChefUpdates", "Home chef updates", "Request submission, assignment, and status changes.", ["household", "chef_staff", "admin"]],
  ["chefRequestMessages", "Chef request messages", "New household/admin messages on chef requests.", ["household", "chef_staff", "admin"]],
  ["groceryReminders", "Grocery reminders", "Grocery list sharing and future reminder workflows.", ["household", "admin"]],
  ["mealPlanReminders", "Meal plan reminders", "Future meal-plan reminders and weekly planning nudges.", ["household", "admin"]],
  ["adminAlerts", "Admin alerts", "Operational alerts for platform admins and support.", ["admin"]],
  ["marketingEmails", "Marketing emails", "Promotional emails. Disabled by default.", ["household", "home_catering", "restaurant", "chef_staff", "admin"]],
] as const;

export const emailPreferenceFields = [
  ["transactionalEnabled", "Transactional and security email", "Account, legal, payment, support, and security messages.", ["all"]],
  ["marketingEnabled", "Marketing email", "Promotions, referrals, credits, and optional campaign messages.", ["household", "home_catering", "restaurant", "chef_staff", "admin"]],
  ["mealPlanningEmails", "Meal planning email", "Meal plan reminders and weekly planning messages.", ["household", "admin"]],
  ["groceryEmails", "Grocery email", "Grocery list sharing, reminders, and checklist messages.", ["household", "admin"]],
  ["orderEmails", "Order email", "Order submissions, status changes, pickup, delivery, and messages.", ["household", "home_catering", "restaurant", "admin"]],
  ["homeChefEmails", "Home chef email", "Home chef request, quote, assignment, and schedule messages.", ["household", "chef_staff", "admin"]],
  ["sellerEmails", "Seller email", "Catering, restaurant, menu, order, and profile messages.", ["home_catering", "restaurant", "admin"]],
  ["paymentEmails", "Payment and billing email", "Payments, invoices, receipts, refunds, subscriptions, and payouts.", ["household", "home_catering", "restaurant", "chef_staff", "admin"]],
  ["verificationEmails", "Verification email", "Seller verification, KYC, documents, and safety review messages.", ["home_catering", "restaurant", "chef_staff", "admin"]],
  ["supportEmails", "Support email", "Support ticket creation, replies, and status changes.", ["household", "home_catering", "restaurant", "chef_staff", "admin"]],
  ["reviewEmails", "Review email", "Review requests, reports, and moderation updates.", ["household", "home_catering", "restaurant", "chef_staff", "admin"]],
  ["promotionEmails", "Promotion email", "Promotion, credit, referral, and loyalty messages.", ["household", "home_catering", "restaurant", "chef_staff", "admin"]],
  ["adminAlertEmails", "Admin alert email", "Operational alerts for platform roles.", ["admin"]],
] as const;

type NotificationPreferenceField = typeof notificationPreferenceFields[number];
type EmailPreferenceField = typeof emailPreferenceFields[number];
type VisibilityScope = NotificationPreferenceField[3][number] | EmailPreferenceField[3][number];

export type NotificationPreferenceFieldName = NotificationPreferenceField[0];
export type EmailPreferenceFieldName = EmailPreferenceField[0];

export type PreferenceVisibilityContext = {
  platformRole?: PlatformRole | null;
  organizationType?: OrganizationType | string | null;
  membershipRole?: OrganizationRole | string | null;
};

export function visibleNotificationPreferenceFields(context: PreferenceVisibilityContext) {
  return notificationPreferenceFields.filter((field) => isFieldVisible(field[3], context));
}

export function visibleEmailPreferenceFields(context: PreferenceVisibilityContext) {
  return emailPreferenceFields.filter((field) => isFieldVisible(field[3], context));
}

export function visibleNotificationPreferenceFieldNames(context: PreferenceVisibilityContext) {
  return visibleNotificationPreferenceFields(context).map((field) => field[0]);
}

export function visibleEmailPreferenceFieldNames(context: PreferenceVisibilityContext) {
  return visibleEmailPreferenceFields(context).map((field) => field[0]);
}

function isFieldVisible(scopes: readonly VisibilityScope[], context: PreferenceVisibilityContext) {
  const audience = preferenceAudience(context);
  return scopes.includes("all") || scopes.includes(audience);
}

function preferenceAudience(context: PreferenceVisibilityContext): Exclude<VisibilityScope, "all"> {
  if (context.platformRole) return "admin";
  if (context.membershipRole === "chef_staff") return "chef_staff";
  if (context.organizationType === "chef_business") return "chef_staff";
  if (context.organizationType === "home_catering") return "home_catering";
  if (context.organizationType === "restaurant") return "restaurant";
  return "household";
}
