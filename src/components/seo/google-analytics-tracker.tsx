"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { canTrackAnalytics, trackEvent, trackPageView } from "@/lib/analytics";
import { isGa4TrackedEvent, type Ga4TrackedEvent } from "@/lib/analytics/events";

declare global {
  interface Window {
    NizamKitchenConsent?: {
      analytics?: boolean;
      marketing?: boolean;
      functional?: boolean;
    };
  }
}

function analyticsConsentGranted() {
  return window.NizamKitchenConsent?.analytics === true;
}

function pathEvents(pathname: string, searchParams: URLSearchParams): Ga4TrackedEvent[] {
  const events: Ga4TrackedEvent[] = [];
  const explicitEvent = searchParams.get("analytics_event");
  if (isGa4TrackedEvent(explicitEvent)) events.push(explicitEvent);

  if (/^\/recipes\/[^/]+$/.test(pathname)) events.push("recipe_view");
  if (/^\/caterers\/[^/]+$/.test(pathname)) events.push("caterer_profile_view");
  if (/^\/restaurants\/[^/]+$/.test(pathname)) events.push("restaurant_profile_view");
  if (searchParams.get("checkout") === "1") events.push("checkout_started");
  if (searchParams.get("payment") === "success" || searchParams.get("checkout") === "success") {
    events.push("payment_completed");
    if (pathname.startsWith("/billing")) events.push("subscription_purchased");
  }

  return Array.from(new Set(events));
}

export function GoogleAnalyticsTracker({
  measurementId,
  requiresConsent = false,
}: {
  measurementId: string;
  requiresConsent?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedKey = useRef<string | null>(null);
  const [consentVersion, setConsentVersion] = useState(0);

  useEffect(() => {
    if (!requiresConsent) return;
    const handler = () => setConsentVersion((version) => version + 1);
    window.addEventListener("nizamkitchen:analytics-consent-changed", handler);
    return () => window.removeEventListener("nizamkitchen:analytics-consent-changed", handler);
  }, [requiresConsent]);

  useEffect(() => {
    if (requiresConsent && !analyticsConsentGranted()) return;
    const query = searchParams.toString();
    const pagePath = `${pathname}${query ? `?${query}` : ""}`;
    const pageLocation = `${window.location.origin}${pagePath}`;
    const key = `${measurementId}:${pathname}:${query}`;
    if (lastTrackedKey.current === key) return;
    if (!canTrackAnalytics()) return;
    lastTrackedKey.current = key;

    trackPageView(pagePath);

    for (const eventName of pathEvents(pathname, searchParams)) {
      trackEvent(eventName, {
        page_location: pageLocation,
        page_path: pathname,
      });
    }
  }, [consentVersion, measurementId, pathname, requiresConsent, searchParams]);

  return null;
}
