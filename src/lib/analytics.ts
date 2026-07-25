"use client";

import { isGa4TrackedEvent, type Ga4TrackedEvent } from "@/lib/analytics/events";

type AnalyticsConsent = {
  analytics?: boolean;
  marketing?: boolean;
  functional?: boolean;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    NizamKitchenAnalyticsMeasurementId?: string;
    NizamKitchenConsentModeEnabled?: boolean;
    NizamKitchenConsent?: AnalyticsConsent;
  }
}

function browserReady() {
  return typeof window !== "undefined";
}

export function getGoogleAnalyticsMeasurementId() {
  if (!browserReady()) return null;
  const measurementId = window.NizamKitchenAnalyticsMeasurementId?.trim();
  return measurementId || null;
}

export function canTrackAnalytics() {
  if (!browserReady()) return false;
  if (typeof window.gtag !== "function") return false;
  if (!getGoogleAnalyticsMeasurementId()) return false;
  if (window.NizamKitchenConsentModeEnabled) {
    return window.NizamKitchenConsent?.analytics === true;
  }
  return true;
}

export function trackEvent(name: "page_view" | Ga4TrackedEvent, params: Record<string, unknown> = {}) {
  if (!canTrackAnalytics()) return false;
  window.gtag?.("event", name, params);
  return true;
}

export function trackPageView(path: string) {
  if (!browserReady()) return false;
  const pagePath = path.startsWith("/") ? path : `/${path}`;
  return trackEvent("page_view", {
    page_location: `${window.location.origin}${pagePath}`,
    page_path: pagePath,
    page_title: document.title,
  });
}

export function trackKnownEvent(name: string | null | undefined, params: Record<string, unknown> = {}) {
  if (!isGa4TrackedEvent(name)) return false;
  return trackEvent(name, params);
}
