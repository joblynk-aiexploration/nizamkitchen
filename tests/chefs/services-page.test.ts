import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { chefServiceSchema } from "@/lib/validation/chefs";

// ──────────────────────────────────────────────────────────────────────────────
// Mocks for action-level tests
// ──────────────────────────────────────────────────────────────────────────────

const { mockUpsertChefService, mockAssertServiceLimit, mockRequireMembership, mockCanAccess, mockIsChefBusiness } =
  vi.hoisted(() => ({
    mockUpsertChefService: vi.fn(),
    mockAssertServiceLimit: vi.fn(),
    mockRequireMembership: vi.fn(),
    mockCanAccess: vi.fn(),
    mockIsChefBusiness: vi.fn(),
  }));

vi.mock("@/server/chefs", () => ({
  upsertChefService: mockUpsertChefService,
  canAccessChefMarketplace: mockCanAccess,
  isChefBusiness: mockIsChefBusiness,
  getChefProfileForOrganization: vi.fn(),
  pauseChefProfile: vi.fn(),
  upsertChefAvailability: vi.fn(),
  upsertChefProfile: vi.fn(),
  addChefVerificationDocument: vi.fn(),
  addChefSpecialty: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireMembership: mockRequireMembership,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  }),
}));
vi.mock("@/lib/analytics/events", () => ({ withAnalyticsEvent: (url: string) => url }));
vi.mock("@/lib/phone", () => ({
  normalizePhoneFromForm: vi.fn(() => null),
  isFormattedPhoneNumber: vi.fn(() => true),
}));
vi.mock("@/server/business-social-links", () => ({
  upsertBusinessSocialLink: vi.fn(),
  deleteBusinessSocialLink: vi.fn(),
}));
vi.mock("@/server/home-chef", () => ({
  createChefHomeChefOrderMessage: vi.fn(),
  updateChefHomeChefOrderStatus: vi.fn(),
}));
vi.mock("@/server/billing", () => ({ assertServiceLimit: mockAssertServiceLimit }));

// Session fixture for action tests
const mockSession = {
  user: { id: "user-1", platformRole: "member" },
  activeOrganization: { id: "org-1", currencyCode: "USD", countryCode: "US", organizationType: "home_chef" },
};

// Helper to build a FormData for the service action
function makeFormData(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    name: "Test Cooking Service",
    serviceType: "daily_cooking",
    basePriceAmount: "150",
    currencyCode: "USD",
    priceUnit: "per_visit",
    minGuests: "5",
    maxGuests: "20",
    description: "A great service.",
    isActive: "on",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    if (v !== undefined) data.set(k, v);
  }
  return data;
}

// ──────────────────────────────────────────────────────────────────────────────
// Schema validation
// ──────────────────────────────────────────────────────────────────────────────

describe("chefServiceSchema — minGuests required", () => {
  it("rejects empty minGuests with 'Minimum guests is required.'", () => {
    const result = chefServiceSchema.safeParse({
      name: "Service",
      serviceType: "daily_cooking",
      currencyCode: "USD",
      priceUnit: "per_visit",
      isActive: true,
      minGuests: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Minimum guests is required.");
    }
  });

  it("identifies minGuests as the failing path", () => {
    const result = chefServiceSchema.safeParse({
      name: "Service",
      serviceType: "daily_cooking",
      currencyCode: "USD",
      priceUnit: "per_visit",
      isActive: true,
      minGuests: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("minGuests");
    }
  });

  it("rejects minGuests below minimum (0)", () => {
    const result = chefServiceSchema.safeParse({
      name: "Service",
      serviceType: "daily_cooking",
      currencyCode: "USD",
      priceUnit: "per_visit",
      isActive: true,
      minGuests: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("minGuests");
    }
  });

  it("rejects non-numeric minGuests (NaN after Number())", () => {
    const result = chefServiceSchema.safeParse({
      name: "Service",
      serviceType: "daily_cooking",
      currencyCode: "USD",
      priceUnit: "per_visit",
      isActive: true,
      minGuests: "abc",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("minGuests");
    }
  });

  it("rejects maxGuests < minGuests and identifies maxGuests", () => {
    const result = chefServiceSchema.safeParse({
      name: "Service",
      serviceType: "daily_cooking",
      currencyCode: "USD",
      priceUnit: "per_visit",
      isActive: true,
      minGuests: 10,
      maxGuests: 5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const maxIssue = result.error.issues.find((i) => i.path[0] === "maxGuests");
      expect(maxIssue?.message).toContain("Maximum guests must be greater than or equal to minimum guests");
    }
  });

  it("accepts a valid service with minGuests set", () => {
    const result = chefServiceSchema.safeParse({
      name: "Valid Service",
      serviceType: "occasion",
      currencyCode: "USD",
      priceUnit: "per_event",
      isActive: true,
      minGuests: 10,
      maxGuests: 50,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid service when correcting only minGuests from a previously-empty value", () => {
    // Simulate the user re-submitting with minGuests filled in.
    const result = chefServiceSchema.safeParse({
      name: "Real User Validation Test Service",
      serviceType: "occasion",
      currencyCode: "USD",
      priceUnit: "per_event",
      basePriceAmount: 250,
      isActive: true,
      minGuests: 10,
      maxGuests: 50,
      description: "Real-user validation state preservation QA.",
    });
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// upsertChefServiceAction — validation failure creates zero records
// ──────────────────────────────────────────────────────────────────────────────

describe("upsertChefServiceAction — validation failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMembership.mockResolvedValue(mockSession);
    mockCanAccess.mockResolvedValue(true);
    mockIsChefBusiness.mockReturnValue(true);
    mockAssertServiceLimit.mockResolvedValue(undefined);
    mockUpsertChefService.mockResolvedValue({ id: "svc-1" });
  });

  it("returns fieldErrors and values when minGuests is missing — does NOT call upsertChefService", async () => {
    const { upsertChefServiceAction } = await import("@/app/(app)/chef/actions");
    const formData = makeFormData({ minGuests: "" });
    const result = await upsertChefServiceAction({}, formData);

    expect(result.error).toBeDefined();
    expect(result.fieldErrors?.minGuests).toBe("Minimum guests is required.");
    expect(result.values?.name).toBe("Test Cooking Service");
    expect(mockUpsertChefService).not.toHaveBeenCalled();
  });

  it("preserves all submitted field values on validation failure", async () => {
    const { upsertChefServiceAction } = await import("@/app/(app)/chef/actions");
    const formData = makeFormData({ minGuests: "", name: "Preserved Name", basePriceAmount: "99", description: "Preserved desc" });
    const result = await upsertChefServiceAction({}, formData);

    expect(result.values?.name).toBe("Preserved Name");
    expect(result.values?.basePriceAmount).toBe("99");
    expect(result.values?.description).toBe("Preserved desc");
    expect(result.values?.maxGuests).toBe("20");
    expect(result.values?.isActive).toBe(true);
  });

  it("does NOT increment service usage on validation failure", async () => {
    const { upsertChefServiceAction } = await import("@/app/(app)/chef/actions");
    const formData = makeFormData({ minGuests: "" });
    await upsertChefServiceAction({}, formData);

    // assertServiceLimit is called inside upsertChefService (server-side), not in the action.
    // Since upsertChefService itself is NOT called on validation failure, the limit is never checked.
    expect(mockUpsertChefService).not.toHaveBeenCalled();
    expect(mockAssertServiceLimit).not.toHaveBeenCalled();
  });

  it("returns fieldErrors for maxGuests < minGuests and preserves all values", async () => {
    const { upsertChefServiceAction } = await import("@/app/(app)/chef/actions");
    const formData = makeFormData({ minGuests: "10", maxGuests: "5" });
    const result = await upsertChefServiceAction({}, formData);

    expect(result.fieldErrors?.maxGuests).toContain("Maximum guests must be greater than or equal to minimum guests");
    expect(result.values?.minGuests).toBe("10");
    expect(result.values?.maxGuests).toBe("5");
    expect(mockUpsertChefService).not.toHaveBeenCalled();
  });

  it("calls upsertChefService exactly once on valid submission", async () => {
    const { upsertChefServiceAction } = await import("@/app/(app)/chef/actions");
    const formData = makeFormData();
    // This will redirect on success (throws redirect error), so we catch it.
    try {
      await upsertChefServiceAction({}, formData);
    } catch {
      // redirect throws — expected on success
    }
    expect(mockUpsertChefService).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ServiceForm component — source checks
// ──────────────────────────────────────────────────────────────────────────────

describe("ServiceForm client component", () => {
  const source = readFileSync("src/app/(app)/chef/services/service-form.tsx", "utf8");

  it("uses useActionState for form state management", () => {
    expect(source).toContain("useActionState");
  });

  it("shows a form-level error banner with role=alert on error", () => {
    expect(source).toContain('role="alert"');
    expect(source).toContain("border-rose-200");
    expect(source).toContain("bg-rose-50");
    expect(source).toContain("text-rose-800");
  });

  it("passes error prop to TextInput for minGuests field-level error", () => {
    expect(source).toContain('error={fe.minGuests}');
    expect(source).toContain('name="minGuests"');
  });

  it("passes error prop to TextInput for maxGuests field-level error", () => {
    expect(source).toContain('error={fe.maxGuests}');
  });

  it("preserves serviceId for edit forms via hidden input", () => {
    expect(source).toContain('name="serviceId"');
    expect(source).toContain("service.id");
  });

  it("preserves all field values from state.values on error", () => {
    expect(source).toContain("state.values?.name");
    expect(source).toContain("state.values?.minGuests");
    expect(source).toContain("state.values?.maxGuests");
    expect(source).toContain("state.values?.description");
  });

  it("includes a pending/loading state on the submit button", () => {
    expect(source).toContain("isPending");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// chef/services/page.tsx — message rendering
// ──────────────────────────────────────────────────────────────────────────────

describe("chef services page", () => {
  const pageSource = readFileSync("src/app/(app)/chef/services/page.tsx", "utf8");

  it("uses FormMessage (not hardcoded green card) for query-param messages", () => {
    expect(pageSource).toContain("FormMessage");
    expect(pageSource).not.toContain('className="border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-800"');
  });

  it("renders Add service and Update service labels", () => {
    expect(pageSource).toContain('"Add service"');
    expect(pageSource).toContain('"Update service"');
  });

  it("imports and uses ServiceForm (Client Component)", () => {
    expect(pageSource).toContain("ServiceForm");
    expect(pageSource).toContain("./service-form");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TextInput error prop
// ──────────────────────────────────────────────────────────────────────────────

describe("TextInput component — error prop", () => {
  const source = readFileSync("src/components/ui/text-input.tsx", "utf8");

  it("accepts an error prop and renders error text with role=alert", () => {
    expect(source).toContain("error?:");
    expect(source).toContain('role="alert"');
    expect(source).toContain("text-rose-600");
  });

  it("sets aria-invalid on the input when error is present", () => {
    expect(source).toContain("aria-invalid");
  });
});
