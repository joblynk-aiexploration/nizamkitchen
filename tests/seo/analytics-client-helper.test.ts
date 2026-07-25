import { afterEach, describe, expect, it, vi } from "vitest";
import { canTrackAnalytics, getGoogleAnalyticsMeasurementId, trackEvent, trackPageView } from "@/lib/analytics";

describe("client analytics helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubBrowser(input: {
    measurementId?: string;
    consentMode?: boolean;
    analyticsConsent?: boolean;
    gtag?: (...args: unknown[]) => void;
  } = {}) {
    const gtag = input.gtag ?? vi.fn();
    vi.stubGlobal("window", {
      location: { origin: "https://nk.friscodawah.org" },
      gtag,
      NizamKitchenAnalyticsMeasurementId: input.measurementId,
      NizamKitchenConsentModeEnabled: input.consentMode,
      NizamKitchenConsent: { analytics: input.analyticsConsent },
    });
    vi.stubGlobal("document", { title: "NizamKitchen" });
    return gtag;
  }

  it("does not track without a configured Measurement ID", () => {
    const gtag = stubBrowser({ analyticsConsent: true });

    expect(getGoogleAnalyticsMeasurementId()).toBeNull();
    expect(canTrackAnalytics()).toBe(false);
    expect(trackPageView("/pricing")).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("blocks tracking before consent when consent mode is enabled", () => {
    const gtag = stubBrowser({ measurementId: "G-TEST123", consentMode: true, analyticsConsent: false });

    expect(getGoogleAnalyticsMeasurementId()).toBe("G-TEST123");
    expect(canTrackAnalytics()).toBe(false);
    expect(trackEvent("login")).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("sends page_view after analytics consent is accepted", () => {
    const gtag = stubBrowser({ measurementId: "G-TEST123", consentMode: true, analyticsConsent: true });

    expect(canTrackAnalytics()).toBe(true);
    expect(trackPageView("/pricing")).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_location: "https://nk.friscodawah.org/pricing",
      page_path: "/pricing",
      page_title: "NizamKitchen",
    });
  });
});
