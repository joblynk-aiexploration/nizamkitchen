import { describe, expect, it } from "vitest";
import {
  emailPreferenceFields,
  notificationPreferenceFields,
  visibleEmailPreferenceFieldNames,
  visibleNotificationPreferenceFieldNames,
} from "@/app/(app)/settings/notifications/preference-fields";

describe("notification preference visibility", () => {
  it("shows household users only household-relevant operational preferences", () => {
    const context = { organizationType: "household", membershipRole: "org_owner", platformRole: null };

    expect(visibleNotificationPreferenceFieldNames(context)).toEqual(expect.arrayContaining([
      "emailEnabled",
      "inAppEnabled",
      "homeChefUpdates",
      "groceryReminders",
      "mealPlanReminders",
    ]));
    expect(visibleEmailPreferenceFieldNames(context)).toEqual(expect.arrayContaining([
      "transactionalEnabled",
      "orderEmails",
      "homeChefEmails",
      "paymentEmails",
      "supportEmails",
    ]));
    expect(visibleEmailPreferenceFieldNames(context)).not.toContain("verificationEmails");
    expect(visibleEmailPreferenceFieldNames(context)).not.toContain("sellerEmails");
    expect(visibleNotificationPreferenceFieldNames(context)).not.toContain("adminAlerts");
  });

  it("shows seller verification preferences to seller roles", () => {
    expect(visibleEmailPreferenceFieldNames({ organizationType: "home_catering", membershipRole: "home_catering_staff" })).toEqual(expect.arrayContaining([
      "orderEmails",
      "sellerEmails",
      "verificationEmails",
    ]));
    expect(visibleEmailPreferenceFieldNames({ organizationType: "restaurant", membershipRole: "restaurant_owner" })).toEqual(expect.arrayContaining([
      "orderEmails",
      "sellerEmails",
      "verificationEmails",
    ]));
  });

  it("shows chef staff home chef and verification preferences without seller menu preferences", () => {
    const fields = visibleEmailPreferenceFieldNames({ organizationType: "chef_business", membershipRole: "chef_staff" });

    expect(fields).toEqual(expect.arrayContaining(["homeChefEmails", "verificationEmails", "paymentEmails"]));
    expect(fields).not.toContain("sellerEmails");
  });

  it("shows every preference to platform owners", () => {
    expect(visibleNotificationPreferenceFieldNames({ platformRole: "platform_owner" })).toHaveLength(notificationPreferenceFields.length);
    expect(visibleEmailPreferenceFieldNames({ platformRole: "platform_owner" })).toHaveLength(emailPreferenceFields.length);
  });
});
