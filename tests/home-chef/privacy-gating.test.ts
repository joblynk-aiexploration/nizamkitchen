import { describe, expect, it } from "vitest";
import {
  canRevealContact,
  canRevealCustomerName,
  canRevealExactAddress,
} from "../../src/server/home-chef/home-chef-booking-lock-service";
import {
  redactCustomerName,
  toAdminRequestView,
  toChefLimitedRequestView,
  toChefLogisticsRequestView,
  toGeneralLocation,
  toHouseholdRequestView,
} from "../../src/server/home-chef/home-chef-redaction";

const policy = {
  allowPreAcceptanceMessaging: true,
  allowFirstNameBeforeAcceptance: true,
  allowPhoneProxyAfterLock: true,
  allowRealPhoneReveal: false,
  allowEmailReveal: false,
  revealExactAddressTrigger: "booking_locked" as const,
  revealCustomerNameTrigger: "booking_locked" as const,
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "hcr_1",
    organizationId: "org_household",
    countryCode: "US",
    createdById: "user_household",
    status: "submitted",
    requestType: "recipe",
    title: "Bagara Baingan dinner",
    description: "Family dinner prep",
    mealPlanId: null,
    recipeId: "recipe_1",
    requestedDate: new Date("2026-06-10T23:00:00.000Z"),
    requestedTimeWindow: "5 PM - 8 PM",
    guestCount: 6,
    householdSize: 4,
    serviceAddressLine1: "123 Private Street",
    serviceAddressLine2: "Apt 4B",
    city: "Frisco",
    region: "TX",
    postalCode: "75035",
    phone: "+15551234567",
    preferredLanguage: "English",
    genderPreference: "no_preference",
    budgetAmount: 250,
    budgetCurrency: "USD",
    paymentRequired: true,
    paymentStatus: "pending",
    paymentOrderId: "pay_1",
    promotionCode: null,
    promotionDiscountAmount: null,
    platformCreditAppliedAmount: null,
    quotedAmount: 250,
    depositAmount: 50,
    currencyCode: "USD",
    paidAt: null,
    notes: "Vegetarian and egg allergy.",
    adminNotes: "Private admin note",
    assignedChefOrganizationId: "org_chef",
    assignedChefProfileId: "chef_1",
    leadTimeCategory: "advance_booking",
    acceptanceDeadlineAt: null,
    currentOfferId: "offer_1",
    autoCascadeEnabled: false,
    cascadeAttemptCount: 0,
    nextCascadeAt: null,
    matchingStatus: "offered",
    bookingLockStatus: "not_locked",
    bookingLockedAt: null,
    bookingLockedById: null,
    bookingLockReason: null,
    addressRevealedAt: null,
    addressAccessRevokedAt: null,
    contactAccessRevokedAt: null,
    confirmedAt: null,
    expiresAt: null,
    recurrenceRuleJson: null,
    recurringDayOfWeek: null,
    recurringStartTime: null,
    recurringEndTime: null,
    preliminaryCallRequested: false,
    preliminaryCallScheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    recipe: { id: "recipe_1", name: "Bagara Baingan", slug: "bagara-baingan" },
    mealPlan: null,
    organization: { id: "org_household", name: "Nizam Family Kitchen", countryCode: "US" },
    createdBy: { id: "user_household", fullName: "Aisha Khan", email: "aisha@example.com" },
    currentOffer: { id: "offer_1", status: "pending", responseDeadlineAt: new Date("2026-06-08T23:00:00.000Z"), chefProfileId: "chef_1" },
    offers: [],
    messages: [],
    statusHistory: [],
    accessGrants: [],
    contactProxySessions: [],
    ...overrides,
  } as never;
}

describe("home chef privacy gating", () => {
  it("chef pre-acceptance view shows general location and hides exact customer details", () => {
    const view = toChefLimitedRequestView({ request: request(), policy: policy as never });

    expect(view.visibilityStage).toBe("chef_limited");
    expect(view.generalLocation).toBe("Frisco");
    expect(view.address.exactAddressLine1).toBeNull();
    expect(view.address.exactAddressLine2).toBeNull();
    expect(view.phone).toBeNull();
    expect(view.email).toBeNull();
    expect(view.customerDisplayName).toBe("NizamKitchen customer");
    expect(view.notes).toContain("Vegetarian");
    expect(view.adminNotes).toBeNull();
  });

  it("custom high-value exception can show first name only", () => {
    expect(redactCustomerName({
      fullName: "Aisha Khan",
      policy: { allowFirstNameBeforeAcceptance: true },
      requestType: "custom",
      canRevealFullName: false,
    })).toBe("Aisha");
  });

  it("accepted but not locked still hides address and contact", () => {
    const view = toChefLimitedRequestView({
      request: request({ status: "accepted", matchingStatus: "chef_accepted" }),
      policy: policy as never,
      accepted: true,
    });

    expect(view.visibilityStage).toBe("chef_accepted_pending_lock");
    expect(view.address.exactAddressLine1).toBeNull();
    expect(view.phone).toBeNull();
  });

  it("booking locked logistics view reveals address but keeps real phone and email hidden by default", () => {
    const view = toChefLogisticsRequestView({
      request: request({
        status: "accepted",
        bookingLockStatus: "locked",
        bookingLockedAt: new Date(),
        contactProxySessions: [{
          id: "proxy_1",
          requestId: "hcr_1",
          householdUserId: "user_household",
          chefProfileId: "chef_1",
          status: "active",
          provider: "manual_placeholder",
          proxyNumber: null,
          startsAt: new Date(),
          expiresAt: new Date("2026-06-11T23:00:00.000Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      }),
      policy: policy as never,
    });

    expect(view.visibilityStage).toBe("chef_logistics");
    expect(view.address.exactAddressLine1).toBe("123 Private Street");
    expect(view.customerDisplayName).toBe("Aisha Khan");
    expect(view.phone).toBeNull();
    expect(view.email).toBeNull();
    expect(view.contactProxy.provider).toBe("manual_placeholder");
  });

  it("reveal checks deny cancelled requests and unrelated chefs", () => {
    const locked = request({ status: "accepted", bookingLockStatus: "locked", bookingLockedAt: new Date() });
    expect(canRevealExactAddress(locked, { role: "chef", chefProfileId: "chef_1" }, policy)).toBe(true);
    expect(canRevealCustomerName(locked, { role: "chef", chefProfileId: "chef_1" }, policy)).toBe(true);
    expect(canRevealContact(locked, { role: "chef", chefProfileId: "chef_1" }, policy)).toBe(true);
    expect(canRevealExactAddress(locked, { role: "chef", chefProfileId: "other_chef" }, policy)).toBe(false);
    expect(canRevealExactAddress(request({ status: "cancelled", bookingLockStatus: "locked", bookingLockedAt: new Date() }), { role: "chef", chefProfileId: "chef_1" }, policy)).toBe(false);
  });

  it("household and admin views retain full details for authorized users", () => {
    expect(toHouseholdRequestView(request()).address.exactAddressLine1).toBe("123 Private Street");
    expect(toAdminRequestView(request()).adminNotes).toBe("Private admin note");
  });

  it("general location never includes street address", () => {
    expect(toGeneralLocation(request())).toBe("Frisco, TX · 75035 area");
    expect(toGeneralLocation(request())).not.toContain("Private Street");
  });
});

describe("home chef privacy source wiring", () => {
  it("chef pages use sanitized DTO services instead of raw chef request includes", async () => {
    const fs = await import("node:fs/promises");
    const detail = await fs.readFile("src/app/(app)/chef/requests/[id]/page.tsx", "utf8");
    const list = await fs.readFile("src/app/(app)/chef/requests/page.tsx", "utf8");
    const service = await fs.readFile("src/server/home-chef/home-chef-request-view-service.ts", "utf8");
    expect(detail).toContain("getHomeChefRequestForViewer");
    expect(detail).not.toContain("getChefHomeChefRequest");
    expect(list).toContain("listChefHomeChefRequestsForViewer");
    expect(list).not.toContain("Household:");
    expect(service).toContain("assignedChefProfileId: chefProfile.id");
    expect(service).toContain("assignedChefOrganizationId: params.session.activeOrganization.id");
  });

  it("admin privacy and booking lock controls are wired", async () => {
    const fs = await import("node:fs/promises");
    const admin = await fs.readFile("src/app/(app)/admin/home-chef-requests/[id]/page.tsx", "utf8");
    const policies = await fs.readFile("src/app/(app)/admin/home-chef/privacy-policies/page.tsx", "utf8");
    expect(admin).toContain("lockHomeChefBookingAction");
    expect(admin).toContain("revokeHomeChefAccessAction");
    expect(admin).toContain("Access grants");
    expect(policies).toContain("Home Chef privacy policies");
    expect(policies).toContain("allowRealPhoneReveal");
  });

  it("paid home chef requests lock through payment milestone hook", async () => {
    const fs = await import("node:fs/promises");
    const stripe = await fs.readFile("src/server/payments/providers/stripe/stripe-webhooks.ts", "utf8");
    const paypal = await fs.readFile("src/server/payments/providers/paypal/paypal-webhooks.ts", "utf8");
    const ops = await fs.readFile("src/server/payments/operations.ts", "utf8");
    expect(stripe).toContain("lockPaidHomeChefRequestsForPaymentOrder");
    expect(paypal).toContain("lockPaidHomeChefRequestsForPaymentOrder");
    expect(ops).toContain("status === \"paid\"");
    expect(ops).toContain("lockPaidHomeChefRequestsForPaymentOrder");
  });

  it("booking lock and blocked-access paths notify without exposing direct contact details", async () => {
    const fs = await import("node:fs/promises");
    const lockService = await fs.readFile("src/server/home-chef/home-chef-booking-lock-service.ts", "utf8");
    const viewService = await fs.readFile("src/server/home-chef/home-chef-request-view-service.ts", "utf8");

    expect(lockService).toContain("home_chef_booking_locked");
    expect(lockService).toContain("home_chef_booking_access_revoked");
    expect(lockService).toContain("home_chef_contact_proxy.created");
    expect(lockService).toContain("home_chef_contact_proxy.revoked");
    expect(lockService).toContain("emailTemplateKey: \"home_chef_request_status_updated\"");
    expect(viewService).toContain("home_chef_privacy_access_blocked");
    expect(`${lockService}\n${viewService}`).not.toContain("serviceAddressLine1}");
    expect(`${lockService}\n${viewService}`).not.toContain("phone}");
  });

  it("does not reintroduce removed AI video analysis wording", async () => {
    const fs = await import("node:fs/promises");
    const files = [
      "src/server/home-chef/home-chef-request-view-service.ts",
      "src/server/home-chef/home-chef-redaction.ts",
      "src/server/home-chef/home-chef-booking-lock-service.ts",
    ];
    for (const file of files) {
      const src = await fs.readFile(file, "utf8");
      expect(src).not.toContain("AI video analysis");
      expect(src).not.toContain("Analyze with AI");
      expect(src).not.toContain("ai_video_analysis");
    }
  });
});
