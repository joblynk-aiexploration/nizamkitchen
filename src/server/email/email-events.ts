import type { EmailTemplateCategory as EmailTemplateCategoryValue } from "@prisma/client";
import type { EmailTemplateSeed } from "./email-types";

const EmailTemplateCategory = {
  authentication: "authentication",
  account: "account",
  legal_privacy: "legal_privacy",
  household: "household",
  meal_planning: "meal_planning",
  grocery: "grocery",
  home_chef: "home_chef",
  chef_staff: "chef_staff",
  home_catering: "home_catering",
  restaurant: "restaurant",
  food_order: "food_order",
  payment: "payment",
  billing: "billing",
  invoice: "invoice",
  refund: "refund",
  payout: "payout",
  verification: "verification",
  storage: "storage",
  support: "support",
  notification: "notification",
  review: "review",
  promotion: "promotion",
  referral: "referral",
  admin_alert: "admin_alert",
  system: "system",
} as const satisfies Record<EmailTemplateCategoryValue, EmailTemplateCategoryValue>;

type EmailTemplateCategory = EmailTemplateCategoryValue;

const COMMON_VARIABLES = [
  { key: "appName", description: "Application name", example: "NizamKitchen", required: true },
  { key: "userName", description: "Recipient display name", example: "Aisha Khan" },
  { key: "userEmail", description: "Recipient email address", example: "aisha@example.com" },
  { key: "organizationName", description: "Organization, household, or seller name", example: "Nizam Family Kitchen" },
  { key: "supportEmail", description: "Support contact email", example: "help@nizamkitchen.dev" },
  { key: "appUrl", description: "Base application URL", example: "https://nk.friscodawah.org" },
  { key: "dashboardUrl", description: "Dashboard URL", example: "https://nk.friscodawah.org/dashboard" },
  { key: "currentYear", description: "Current calendar year", example: "2026" },
  { key: "privacyUrl", description: "Privacy policy URL", example: "https://nk.friscodawah.org/privacy" },
  { key: "termsUrl", description: "Terms URL", example: "https://nk.friscodawah.org/terms" },
  { key: "notificationPreferencesUrl", description: "Notification preference URL", example: "https://nk.friscodawah.org/settings/notifications" },
] satisfies EmailTemplateSeed["variables"];

const ORDER_VARIABLES = [
  { key: "orderNumber", description: "Order number", example: "NK-10025" },
  { key: "orderStatus", description: "Order status", example: "accepted" },
  { key: "sellerName", description: "Seller name", example: "Nizam Home Catering" },
  { key: "customerName", description: "Customer name", example: "Nizam Family Kitchen" },
  { key: "orderUrl", description: "Order detail URL", example: "https://nk.friscodawah.org/orders/123" },
  { key: "requestedDate", description: "Requested date/time", example: "May 28, 2026 at 6:00 PM" },
  { key: "fulfillmentType", description: "Pickup, delivery, or preorder", example: "delivery" },
  { key: "totalAmount", description: "Total amount", example: "45.00" },
  { key: "currencyCode", description: "Currency code", example: "USD" },
] satisfies EmailTemplateSeed["variables"];

const HOME_CHEF_VARIABLES = [
  { key: "requestTitle", description: "Home chef request title", example: "Friday biryani dinner" },
  { key: "requestStatus", description: "Request status", example: "under review" },
  { key: "chefName", description: "Chef name", example: "Nizam Independent Home Chef" },
  { key: "householdName", description: "Household name", example: "Nizam Family Kitchen" },
  { key: "requestUrl", description: "Request detail URL", example: "https://nk.friscodawah.org/home-chef/requests/123" },
  { key: "scheduledDate", description: "Scheduled date/time", example: "May 30, 2026 at 5:00 PM" },
  { key: "quoteAmount", description: "Quote amount", example: "120.00" },
] satisfies EmailTemplateSeed["variables"];

const PAYMENT_VARIABLES = [
  { key: "paymentAmount", description: "Payment amount", example: "59.99" },
  { key: "currencyCode", description: "Currency code", example: "USD" },
  { key: "receiptUrl", description: "Receipt URL", example: "https://nk.friscodawah.org/billing/receipts" },
  { key: "invoiceUrl", description: "Invoice URL", example: "https://nk.friscodawah.org/billing/invoices" },
  { key: "paymentStatus", description: "Payment status", example: "paid" },
  { key: "refundAmount", description: "Refund amount", example: "15.00" },
] satisfies EmailTemplateSeed["variables"];

const VERIFICATION_VARIABLES = [
  { key: "sellerName", description: "Seller profile name", example: "Nizam Home Catering" },
  { key: "verificationStatus", description: "Verification status", example: "approved" },
  { key: "documentName", description: "Document name", example: "Food handler certificate" },
  { key: "rejectionReason", description: "Reason when rejected", example: "Document is expired" },
  { key: "verificationUrl", description: "Verification page URL", example: "https://nk.friscodawah.org/catering/verification" },
  { key: "expiryDate", description: "Document expiry date", example: "June 30, 2026" },
] satisfies EmailTemplateSeed["variables"];

const SUPPORT_VARIABLES = [
  { key: "ticketNumber", description: "Support ticket number", example: "TKT-1001" },
  { key: "ticketTitle", description: "Support ticket title", example: "Order question" },
  { key: "ticketStatus", description: "Support ticket status", example: "open" },
  { key: "ticketUrl", description: "Ticket URL", example: "https://nk.friscodawah.org/support/tickets/123" },
] satisfies EmailTemplateSeed["variables"];

const ADMIN_ALERT_VARIABLES = [
  { key: "alertTitle", description: "Alert title", example: "Failed payment webhook" },
  { key: "alertSeverity", description: "Alert severity", example: "critical" },
  { key: "alertUrl", description: "Alert detail URL", example: "https://nk.friscodawah.org/admin/system/alerts/123" },
  { key: "integrationName", description: "Integration name", example: "Stripe" },
] satisfies EmailTemplateSeed["variables"];

function template(params: Omit<EmailTemplateSeed, "variables"> & { variables?: EmailTemplateSeed["variables"] }): EmailTemplateSeed {
  return {
    ...params,
    variables: [...COMMON_VARIABLES, ...(params.variables ?? [])],
  };
}

function operational(
  key: string,
  category: EmailTemplateCategory,
  name: string,
  subject: string,
  body: string,
  variables?: EmailTemplateSeed["variables"],
  ctaUrlVariable = "dashboardUrl",
  ctaLabel = "View details",
) {
  return template({
    templateKey: key,
    name,
    category,
    subject,
    preheader: "A NizamKitchen account update is available.",
    title: subject,
    body,
    ctaLabel,
    ctaUrlVariable,
    variables,
  });
}

export const ENTERPRISE_EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  operational("auth.welcome", EmailTemplateCategory.authentication, "Welcome email", "Welcome to NizamKitchen", "Hello {{userName}},\n\nYour NizamKitchen account is ready. You can now plan meals, browse recipes, manage requests, and use your workspace tools.", undefined, "dashboardUrl"),
  operational("auth.verify_email", EmailTemplateCategory.authentication, "Verify email", "Verify your NizamKitchen email", "Hello {{userName}},\n\nPlease verify {{userEmail}} so we can keep your account secure.", [{ key: "verifyUrl", description: "Email verification URL", example: "https://nk.friscodawah.org/verify", required: true }], "verifyUrl"),
  operational(
    "auth.password_reset",
    EmailTemplateCategory.authentication,
    "Password reset",
    "Reset your NizamKitchen password",
    "Hello {{userName}},\n\nWe received a request to reset the password for your NizamKitchen account. Use the secure button below to choose a new password.\n\nThis link expires in {{expiresInMinutes}} minutes. If you did not request a password reset, you can ignore this email and your password will not change.\n\nFor your security, do not forward this email. If the button does not work, copy and paste this secure reset link into your browser:\n{{resetUrl}}",
    [
      { key: "resetUrl", description: "Password reset URL", example: "https://nk.friscodawah.org/reset-password?token=...", required: true },
      { key: "expiresInMinutes", description: "Reset link expiration window", example: "45", required: true },
    ],
    "resetUrl",
    "Reset password",
  ),
  operational("auth.password_changed", EmailTemplateCategory.authentication, "Password changed", "Your NizamKitchen password was changed", "Hello {{userName}},\n\nYour password was changed. If this was not you, contact support immediately."),
  operational("auth.new_login_alert", EmailTemplateCategory.authentication, "New login alert", "New sign-in to your NizamKitchen account", "Hello {{userName}},\n\nWe noticed a new sign-in to your account. If this was not you, reset your password and contact support."),
  operational("auth.account_disabled", EmailTemplateCategory.account, "Account disabled", "Your NizamKitchen account is disabled", "Hello {{userName}},\n\nYour account is currently disabled. Contact support if you believe this needs review.", undefined, "dashboardUrl"),
  operational("auth.account_reactivated", EmailTemplateCategory.account, "Account reactivated", "Your NizamKitchen account was reactivated", "Hello {{userName}},\n\nYour account has been reactivated and you can sign in again.", undefined, "dashboardUrl"),
  operational("auth.oauth_linked", EmailTemplateCategory.authentication, "Social login linked", "A social login was linked to your account", "Hello {{userName}},\n\nA Google or Facebook sign-in method was linked to your NizamKitchen account."),

  operational("legal.terms_updated", EmailTemplateCategory.legal_privacy, "Terms updated", "Updated NizamKitchen terms require review", "Hello {{userName}},\n\nOur Terms of Service were updated. Please review and accept the latest version before continuing normal platform activity.", undefined, "termsUrl"),
  operational("legal.privacy_updated", EmailTemplateCategory.legal_privacy, "Privacy updated", "Updated NizamKitchen privacy policy", "Hello {{userName}},\n\nOur Privacy Policy was updated. Please review the latest version at your convenience.", undefined, "privacyUrl"),
  operational("privacy.data_export_requested", EmailTemplateCategory.legal_privacy, "Data export requested", "We received your data export request", "Hello {{userName}},\n\nWe received your data export request and will notify you when it is ready.", undefined, "dashboardUrl"),
  operational("privacy.data_export_ready", EmailTemplateCategory.legal_privacy, "Data export ready", "Your NizamKitchen data export is ready", "Hello {{userName}},\n\nYour requested data export is ready in your privacy center.", undefined, "dashboardUrl"),
  operational("privacy.account_deletion_requested", EmailTemplateCategory.legal_privacy, "Deletion requested", "We received your account deletion request", "Hello {{userName}},\n\nWe received your request and will review records that must be retained for accounting, safety, or security reasons."),
  operational("privacy.account_deletion_completed", EmailTemplateCategory.legal_privacy, "Deletion completed", "Your account deletion request was completed", "Hello {{userName}},\n\nYour account deletion or anonymization request has been completed where allowed by retention requirements."),

  operational("household.welcome", EmailTemplateCategory.household, "Household welcome", "Welcome to your household kitchen", "Hello {{userName}},\n\nYour household workspace is ready for recipes, grocery lists, meal plans, chef requests, and orders."),
  operational("meal_plan.created", EmailTemplateCategory.meal_planning, "Meal plan created", "Your meal plan was created", "Hello {{userName}},\n\nYour meal plan is ready. You can review meals, adjust servings, and generate a grocery list.", undefined, "dashboardUrl"),
  operational("meal_plan.weekly_reminder", EmailTemplateCategory.meal_planning, "Weekly meal reminder", "Your weekly meal planning reminder", "Hello {{userName}},\n\nA new week is coming up. Review your meals and grocery list so your household is ready.", undefined, "dashboardUrl"),
  operational("grocery_list.generated", EmailTemplateCategory.grocery, "Grocery list generated", "Your grocery list is ready", "Hello {{userName}},\n\nYour grocery list has been generated from selected recipes and servings.", undefined, "dashboardUrl"),
  operational("grocery_list.shared", EmailTemplateCategory.grocery, "Grocery list shared", "A grocery list was shared with you", "Hello {{userName}},\n\nA grocery list was shared with you from NizamKitchen. Open it to view the shopping checklist.", [{ key: "shareUrl", description: "Shared grocery list URL", example: "https://nk.friscodawah.org/share/grocery-lists/..." }], "shareUrl"),
  operational("grocery_list.shopping_reminder", EmailTemplateCategory.grocery, "Shopping reminder", "Shopping reminder for your grocery list", "Hello {{userName}},\n\nYour grocery checklist is ready for offline shopping or sharing."),

  operational("home_chef.request_submitted", EmailTemplateCategory.home_chef, "Home chef request submitted", "Your home chef request was submitted", "Hello {{userName}},\n\nWe received your request for {{requestTitle}} and will keep you updated as it progresses.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.admin_new_request", EmailTemplateCategory.admin_alert, "Admin new home chef request", "New home chef request needs review", "A new home chef request was submitted by {{householdName}} and may need platform review.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.request_under_review", EmailTemplateCategory.home_chef, "Request under review", "Your home chef request is under review", "Hello {{userName}},\n\nYour request {{requestTitle}} is under review. We will notify you when there is an update.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.chef_matched", EmailTemplateCategory.home_chef, "Chef matched", "A chef was matched to your request", "Hello {{userName}},\n\n{{chefName}} was matched to your request. Review the details in your dashboard.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.chef_assigned", EmailTemplateCategory.home_chef, "Chef assigned", "A chef was assigned to your request", "Hello {{userName}},\n\n{{chefName}} was assigned to {{requestTitle}}.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.quote_sent", EmailTemplateCategory.home_chef, "Quote sent", "A quote is ready for your home chef request", "Hello {{userName}},\n\nA quote of {{quoteAmount}} was sent for {{requestTitle}}.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.quote_accepted", EmailTemplateCategory.home_chef, "Quote accepted", "Your home chef quote was accepted", "Hello {{userName}},\n\nThe quote for {{requestTitle}} was accepted.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.request_scheduled", EmailTemplateCategory.home_chef, "Request scheduled", "Your home chef request was scheduled", "Hello {{userName}},\n\n{{requestTitle}} is scheduled for {{scheduledDate}}.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.upcoming_reminder", EmailTemplateCategory.home_chef, "Upcoming home chef reminder", "Your home chef booking is coming up", "Hello {{userName}},\n\nThis is a reminder for {{requestTitle}} scheduled on {{scheduledDate}}.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.message_received", EmailTemplateCategory.home_chef, "Home chef message", "New message on your home chef request", "Hello {{userName}},\n\nYou have a new message on {{requestTitle}}.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.request_cancelled", EmailTemplateCategory.home_chef, "Request cancelled", "Your home chef request was cancelled", "Hello {{userName}},\n\n{{requestTitle}} has been cancelled.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.request_completed", EmailTemplateCategory.home_chef, "Request completed", "Your home chef request was completed", "Hello {{userName}},\n\n{{requestTitle}} has been marked complete.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("home_chef.review_request", EmailTemplateCategory.review, "Home chef review request", "How was your home chef experience?", "Hello {{userName}},\n\nPlease leave a verified review for {{chefName}} after your completed request.", HOME_CHEF_VARIABLES, "requestUrl"),

  operational("chef_staff.assigned_request", EmailTemplateCategory.chef_staff, "Chef assigned request", "A home chef order was assigned to you", "Hello {{userName}},\n\nYou have a new order/request: {{requestTitle}}. Please review and accept or decline.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("chef_staff.request_cancelled", EmailTemplateCategory.chef_staff, "Chef request cancelled", "A home chef order was cancelled", "Hello {{userName}},\n\n{{requestTitle}} has been cancelled.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("chef_staff.schedule_updated", EmailTemplateCategory.chef_staff, "Chef schedule update", "Your chef schedule was updated", "Hello {{userName}},\n\nA schedule update was recorded for {{requestTitle}}.", HOME_CHEF_VARIABLES, "requestUrl"),
  operational("chef_staff.payout_update", EmailTemplateCategory.payout, "Chef payout update", "Chef payout update", "Hello {{userName}},\n\nThere is a payout update for your chef account.", PAYMENT_VARIABLES, "dashboardUrl"),

  operational("catering.profile_submitted", EmailTemplateCategory.home_catering, "Catering profile submitted", "Your catering profile was submitted", "Hello {{userName}},\n\nYour catering profile was submitted for review.", VERIFICATION_VARIABLES, "verificationUrl"),
  operational("catering.profile_approved", EmailTemplateCategory.home_catering, "Catering profile approved", "Your catering profile was approved", "Hello {{userName}},\n\n{{sellerName}} is approved and can be visible according to platform policy.", VERIFICATION_VARIABLES, "verificationUrl"),
  operational("catering.profile_rejected", EmailTemplateCategory.home_catering, "Catering profile rejected", "Your catering profile needs changes", "Hello {{userName}},\n\n{{sellerName}} needs changes before approval. Reason: {{rejectionReason}}", VERIFICATION_VARIABLES, "verificationUrl"),
  operational("catering.profile_suspended", EmailTemplateCategory.home_catering, "Catering profile suspended", "Your catering profile was suspended", "Hello {{userName}},\n\n{{sellerName}} was suspended. Review the details in your dashboard.", VERIFICATION_VARIABLES, "verificationUrl"),
  operational("catering.new_order", EmailTemplateCategory.food_order, "Catering new order", "New catering order request", "Hello {{userName}},\n\nYou received order {{orderNumber}} from {{customerName}}.", ORDER_VARIABLES, "orderUrl"),
  operational("catering.order_cancelled", EmailTemplateCategory.food_order, "Catering order cancelled", "A catering order was cancelled", "Hello {{userName}},\n\nOrder {{orderNumber}} was cancelled.", ORDER_VARIABLES, "orderUrl"),
  operational("catering.review_received", EmailTemplateCategory.review, "Catering review received", "A new review was received", "Hello {{userName}},\n\n{{sellerName}} received a new verified review.", VERIFICATION_VARIABLES, "dashboardUrl"),

  operational("restaurant.profile_created", EmailTemplateCategory.restaurant, "Restaurant profile created", "Your restaurant profile was created", "Hello {{userName}},\n\nYour restaurant profile was created and can be reviewed in your dashboard.", VERIFICATION_VARIABLES, "verificationUrl"),
  operational("restaurant.profile_approved", EmailTemplateCategory.restaurant, "Restaurant profile approved", "Your restaurant profile was approved", "Hello {{userName}},\n\n{{sellerName}} is approved and ready according to platform policy.", VERIFICATION_VARIABLES, "verificationUrl"),
  operational("restaurant.profile_rejected", EmailTemplateCategory.restaurant, "Restaurant profile rejected", "Your restaurant profile needs changes", "Hello {{userName}},\n\n{{sellerName}} needs changes before approval. Reason: {{rejectionReason}}", VERIFICATION_VARIABLES, "verificationUrl"),
  operational("restaurant.new_order", EmailTemplateCategory.food_order, "Restaurant new order", "New restaurant order request", "Hello {{userName}},\n\nYou received order {{orderNumber}} from {{customerName}}.", ORDER_VARIABLES, "orderUrl"),
  operational("restaurant.order_cancelled", EmailTemplateCategory.food_order, "Restaurant order cancelled", "A restaurant order was cancelled", "Hello {{userName}},\n\nOrder {{orderNumber}} was cancelled.", ORDER_VARIABLES, "orderUrl"),
  operational("restaurant.review_received", EmailTemplateCategory.review, "Restaurant review received", "A new review was received", "Hello {{userName}},\n\n{{sellerName}} received a new verified review.", VERIFICATION_VARIABLES, "dashboardUrl"),

  ...[
    ["order.submitted", "Your NizamKitchen order request was submitted", "We received order {{orderNumber}} for {{sellerName}} and will notify you when the seller responds."],
    ["order.accepted", "Your NizamKitchen order was accepted", "Order {{orderNumber}} was accepted by {{sellerName}}."],
    ["order.declined", "Your NizamKitchen order was declined", "Order {{orderNumber}} was declined. You can review details or contact support."],
    ["order.preparing", "Your order is being prepared", "{{sellerName}} is preparing order {{orderNumber}}."],
    ["order.ready_for_pickup", "Your order is ready for pickup", "Order {{orderNumber}} is ready for pickup."],
    ["order.out_for_delivery", "Your order is out for delivery", "Order {{orderNumber}} is out for delivery."],
    ["order.completed", "Your order was completed", "Order {{orderNumber}} was completed."],
    ["order.cancelled", "Your order was cancelled", "Order {{orderNumber}} was cancelled."],
    ["order.message_received", "New message about your order", "You have a new message about order {{orderNumber}}."],
  ].map(([key, subject, body]) => operational(key, EmailTemplateCategory.food_order, subject, subject, `Hello {{userName}},\n\n${body}`, ORDER_VARIABLES, "orderUrl")),

  ...[
    ["payment.success", "Payment successful", "Payment of {{paymentAmount}} {{currencyCode}} was successful."],
    ["payment.failed", "Payment failed", "Payment of {{paymentAmount}} {{currencyCode}} failed. Please review your payment method."],
    ["payment.cancelled", "Payment cancelled", "Payment was cancelled."],
    ["refund.requested", "Refund requested", "A refund of {{refundAmount}} {{currencyCode}} was requested."],
    ["refund.approved", "Refund approved", "A refund of {{refundAmount}} {{currencyCode}} was approved."],
    ["refund.processed", "Refund processed", "A refund of {{refundAmount}} {{currencyCode}} was processed."],
    ["refund.failed", "Refund failed", "A refund could not be processed."],
    ["invoice.issued", "Invoice issued", "A new invoice is available."],
    ["receipt.available", "Receipt available", "A receipt is available for your payment."],
    ["subscription.started", "Subscription started", "Your subscription has started."],
    ["subscription.renewed", "Subscription renewed", "Your subscription was renewed."],
    ["subscription.payment_failed", "Subscription payment failed", "Your subscription payment failed."],
    ["subscription.cancelled", "Subscription cancelled", "Your subscription was cancelled."],
    ["payout.setup_required", "Payout setup required", "Payout setup is required before payouts can be sent."],
    ["payout.account_approved", "Payout account approved", "Your payout account was approved."],
    ["payout.sent", "Payout sent", "A payout was sent."],
    ["payout.failed", "Payout failed", "A payout failed and needs review."],
    ["dispute.opened", "Payment dispute opened", "A payment dispute was opened."],
    ["dispute.updated", "Payment dispute updated", "A payment dispute was updated."],
  ].map(([key, subject, body]) => operational(key, key.startsWith("refund.") ? EmailTemplateCategory.refund : key.startsWith("payout.") ? EmailTemplateCategory.payout : key.startsWith("invoice.") ? EmailTemplateCategory.invoice : EmailTemplateCategory.payment, subject, subject, `Hello {{userName}},\n\n${body}`, PAYMENT_VARIABLES, key.startsWith("invoice.") ? "invoiceUrl" : key.startsWith("receipt.") ? "receiptUrl" : "dashboardUrl")),

  ...[
    ["verification.started", "Verification started", "Verification has started for {{sellerName}}."],
    ["verification.document_uploaded", "Verification document uploaded", "{{documentName}} was uploaded for {{sellerName}}."],
    ["verification.document_approved", "Verification document approved", "{{documentName}} was approved."],
    ["verification.document_rejected", "Verification document rejected", "{{documentName}} was rejected. Reason: {{rejectionReason}}"],
    ["verification.more_info_requested", "More verification information requested", "More information is required for {{sellerName}}."],
    ["verification.approved", "Verification approved", "{{sellerName}} was approved."],
    ["verification.rejected", "Verification rejected", "{{sellerName}} was rejected. Reason: {{rejectionReason}}"],
    ["verification.suspended", "Verification suspended", "{{sellerName}} was suspended."],
    ["verification.certificate_expiring", "Food certificate expiring", "{{documentName}} expires on {{expiryDate}}."],
    ["verification.permit_expiring", "Seller permit expiring", "{{documentName}} expires on {{expiryDate}}."],
    ["verification.kitchen_review_submitted", "Kitchen review submitted", "A kitchen safety review was submitted."],
    ["verification.kitchen_review_approved", "Kitchen review approved", "A kitchen safety review was approved."],
    ["verification.kitchen_review_rejected", "Kitchen review rejected", "A kitchen safety review was rejected. Reason: {{rejectionReason}}"],
    ["verification.background_consent_required", "Background check consent required", "Background check consent is required before verification can continue."],
    ["verification.background_status_updated", "Background check status updated", "Background check status changed to {{verificationStatus}}."],
  ].map(([key, subject, body]) => operational(key, EmailTemplateCategory.verification, subject, subject, `Hello {{userName}},\n\n${body}`, VERIFICATION_VARIABLES, "verificationUrl")),

  operational("storage.file_uploaded", EmailTemplateCategory.storage, "Storage file uploaded", "A file was uploaded", "Hello {{userName}},\n\nA file was uploaded to NizamKitchen storage."),
  operational("storage.shared_link_created", EmailTemplateCategory.storage, "Shared link created", "A file sharing link was created", "Hello {{userName}},\n\nA storage sharing link was created."),
  operational("storage.shared_link_revoked", EmailTemplateCategory.storage, "Shared link revoked", "A file sharing link was revoked", "Hello {{userName}},\n\nA storage sharing link was revoked."),
  operational("storage.configuration_failed", EmailTemplateCategory.admin_alert, "Storage configuration failed", "Storage configuration test failed", "A storage configuration test failed and needs admin review.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("storage.configuration_success", EmailTemplateCategory.admin_alert, "Storage configuration succeeded", "Storage configuration test succeeded", "A storage configuration test succeeded.", ADMIN_ALERT_VARIABLES, "alertUrl"),

  operational("support.ticket_created", EmailTemplateCategory.support, "Support ticket created", "Your support ticket was created", "Hello {{userName}},\n\nTicket {{ticketNumber}} was created for {{ticketTitle}}.", SUPPORT_VARIABLES, "ticketUrl"),
  operational("support.admin_new_ticket", EmailTemplateCategory.admin_alert, "Admin new support ticket", "New support ticket received", "A new support ticket {{ticketNumber}} was created: {{ticketTitle}}.", SUPPORT_VARIABLES, "ticketUrl"),
  operational("support.reply_received", EmailTemplateCategory.support, "Support reply received", "New reply on your support ticket", "Hello {{userName}},\n\nA new reply was added to ticket {{ticketNumber}}.", SUPPORT_VARIABLES, "ticketUrl"),
  operational("support.status_changed", EmailTemplateCategory.support, "Support status changed", "Your support ticket status changed", "Hello {{userName}},\n\nTicket {{ticketNumber}} is now {{ticketStatus}}.", SUPPORT_VARIABLES, "ticketUrl"),
  operational("support.ticket_closed", EmailTemplateCategory.support, "Support ticket closed", "Your support ticket was closed", "Hello {{userName}},\n\nTicket {{ticketNumber}} was closed.", SUPPORT_VARIABLES, "ticketUrl"),
  operational("support.feedback_received", EmailTemplateCategory.support, "Support feedback received", "Support feedback received", "Hello {{userName}},\n\nThank you for sharing feedback with NizamKitchen.", SUPPORT_VARIABLES, "ticketUrl"),

  operational("review.request", EmailTemplateCategory.review, "Review request", "Please share a verified review", "Hello {{userName}},\n\nYour order/request is complete. Please share a verified review.", ORDER_VARIABLES, "orderUrl"),
  operational("review.submitted", EmailTemplateCategory.review, "Review submitted", "Your review was submitted", "Hello {{userName}},\n\nThank you. Your review was submitted and may be moderated before publishing."),
  operational("review.published", EmailTemplateCategory.review, "Review published", "Your review was published", "Hello {{userName}},\n\nYour review was published."),
  operational("review.reported", EmailTemplateCategory.review, "Review reported", "A review was reported", "A review was reported and needs moderation."),
  operational("review.removed", EmailTemplateCategory.review, "Review removed", "A review was removed", "A review was removed after moderation."),
  operational("review.seller_reply_posted", EmailTemplateCategory.review, "Seller reply posted", "A seller replied to a review", "Hello {{userName}},\n\nA seller reply was posted on a review."),
  operational("complaint.received", EmailTemplateCategory.support, "Complaint received", "Your complaint was received", "Hello {{userName}},\n\nWe received your complaint and will review it."),
  operational("complaint.resolved", EmailTemplateCategory.support, "Complaint resolved", "Your complaint was resolved", "Hello {{userName}},\n\nYour complaint was marked resolved."),

  template({ templateKey: "promotion.code_available", name: "Promotion code available", category: EmailTemplateCategory.promotion, subject: "A NizamKitchen promotion is available", preheader: "A promotion is available for eligible users.", title: "Promotion available", body: "Hello {{userName}},\n\nA promotion is available for eligible NizamKitchen activity. Review details in your account.", ctaLabel: "View promotion", ctaUrlVariable: "dashboardUrl", marketing: true }),
  template({ templateKey: "credit.granted", name: "Credit granted", category: EmailTemplateCategory.promotion, subject: "NizamKitchen credit was added", preheader: "A credit was added to your account.", title: "Credit added", body: "Hello {{userName}},\n\nA platform credit was added to your account.", ctaLabel: "View credits", ctaUrlVariable: "dashboardUrl" }),
  template({ templateKey: "credit.expiring", name: "Credit expiring", category: EmailTemplateCategory.promotion, subject: "Your NizamKitchen credit is expiring", preheader: "Review expiring platform credit.", title: "Credit expiring", body: "Hello {{userName}},\n\nA platform credit on your account is expiring soon.", ctaLabel: "View credits", ctaUrlVariable: "dashboardUrl", marketing: true }),
  template({ templateKey: "referral.code_created", name: "Referral code created", category: EmailTemplateCategory.referral, subject: "Your NizamKitchen referral code is ready", preheader: "Your referral code is ready.", title: "Referral code ready", body: "Hello {{userName}},\n\nYour referral code is ready to share where eligible.", ctaLabel: "View referral", ctaUrlVariable: "dashboardUrl", marketing: true }),
  template({ templateKey: "referral.reward_earned", name: "Referral reward earned", category: EmailTemplateCategory.referral, subject: "You earned a NizamKitchen referral reward", preheader: "A referral reward was added.", title: "Referral reward earned", body: "Hello {{userName}},\n\nYou earned a referral reward.", ctaLabel: "View reward", ctaUrlVariable: "dashboardUrl" }),

  operational("admin.failed_payment_webhook", EmailTemplateCategory.admin_alert, "Failed payment webhook", "Payment webhook failure needs review", "A payment webhook failed and needs admin review.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("admin.failed_s3_test", EmailTemplateCategory.admin_alert, "Failed storage test", "Storage test failed", "A storage integration test failed and needs admin review.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("admin.failed_email_delivery", EmailTemplateCategory.admin_alert, "Failed email delivery", "Email delivery failed", "An email delivery failure needs admin review.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("admin.integration_error", EmailTemplateCategory.admin_alert, "Integration error", "Integration error needs review", "{{integrationName}} reported an error.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("admin.seller_verification_pending", EmailTemplateCategory.admin_alert, "Seller verification pending", "Seller verification needs review", "A seller verification is pending admin review.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("admin.dispute_opened", EmailTemplateCategory.admin_alert, "Dispute opened", "Payment dispute opened", "A payment dispute was opened and needs review.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("admin.suspicious_activity", EmailTemplateCategory.admin_alert, "Suspicious activity", "Suspicious activity detected", "Suspicious activity was detected and needs review.", ADMIN_ALERT_VARIABLES, "alertUrl"),
  operational("admin.failed_login_spike", EmailTemplateCategory.admin_alert, "Failed login spike", "Failed login spike detected", "A repeated failed login pattern was detected.", ADMIN_ALERT_VARIABLES, "alertUrl"),
];

export const TRANSACTIONAL_EMAIL_CATEGORIES = new Set<EmailTemplateCategory>([
  EmailTemplateCategory.authentication,
  EmailTemplateCategory.account,
  EmailTemplateCategory.legal_privacy,
  EmailTemplateCategory.food_order,
  EmailTemplateCategory.payment,
  EmailTemplateCategory.billing,
  EmailTemplateCategory.invoice,
  EmailTemplateCategory.refund,
  EmailTemplateCategory.payout,
  EmailTemplateCategory.verification,
  EmailTemplateCategory.support,
  EmailTemplateCategory.admin_alert,
  EmailTemplateCategory.system,
]);

export function isMarketingTemplate(templateKey: string, category: EmailTemplateCategory) {
  const template = ENTERPRISE_EMAIL_TEMPLATES.find((item) => item.templateKey === templateKey);
  return Boolean(template?.marketing || category === EmailTemplateCategory.promotion || category === EmailTemplateCategory.referral);
}
