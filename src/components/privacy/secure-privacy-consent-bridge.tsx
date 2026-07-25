"use client";

import { useEffect } from "react";

type ConsentState = {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
};

declare global {
  interface Window {
    NizamKitchenConsentModeEnabled?: boolean;
    NizamKitchenConsent?: Partial<ConsentState>;
    gtag?: (...args: unknown[]) => void;
  }
}

function boolFromValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (["true", "granted", "grant", "allow", "allowed", "accepted", "yes", "1", "on"].includes(normalized)) return true;
  if (["false", "denied", "deny", "rejected", "no", "0", "off"].includes(normalized)) return false;
  return null;
}

function findConsentValue(value: unknown, keys: string[]): boolean | null {
  const direct = boolFromValue(value);
  if (direct !== null) return direct;
  if (!value || typeof value !== "object") return null;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (keys.some((target) => normalizedKey.includes(target))) {
      const found = findConsentValue(nested, keys);
      if (found !== null) return found;
    }
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findConsentValue(nested, keys);
    if (found !== null) return found;
  }

  return null;
}

function hasConsentAllSignal(value: unknown): boolean {
  if (typeof value === "string") {
    return /(all|accepted|allow|granted|true)/i.test(value) && !/(reject|denied|false)/i.test(value);
  }
  if (!value || typeof value !== "object") return false;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (/(all|acceptall|allaccepted|necessary|analytics|marketing|functional|preferences|statistics)/i.test(normalizedKey)) {
      const bool = boolFromValue(nested);
      if (bool === true) return true;
    }
    if (hasConsentAllSignal(nested)) return true;
  }

  return false;
}

function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}

function consentValuesFromStorage() {
  const values: unknown[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) ?? "";
      if (!/(secureprivacy|secure_privacy|cookie|consent)/i.test(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value) values.push(parseMaybeJson(value));
    }
  } catch {
    // Storage can be unavailable in strict browser modes.
  }

  for (const cookie of document.cookie.split(";")) {
    const [key, ...parts] = cookie.trim().split("=");
    if (!/(secureprivacy|secure_privacy|cookie|consent)/i.test(key)) continue;
    values.push(parseMaybeJson(parts.join("=")));
  }

  return values;
}

function readConsent(): ConsentState {
  const explicit = window.NizamKitchenConsent;
  const storageValues = consentValuesFromStorage();
  const values = explicit ? [explicit, ...storageValues] : storageValues;
  const acceptedAll = values.some(hasConsentAllSignal);

  const analytics = values
    .map((value) => findConsentValue(value, ["analytics", "statistic", "measurement"]))
    .find((value): value is boolean => value !== null);
  const marketing = values
    .map((value) => findConsentValue(value, ["marketing", "advertising", "ad_storage", "ads"]))
    .find((value): value is boolean => value !== null);
  const functional = values
    .map((value) => findConsentValue(value, ["functional", "functionality", "preference"]))
    .find((value): value is boolean => value !== null);

  return {
    analytics: analytics ?? acceptedAll,
    marketing: marketing ?? acceptedAll,
    functional: functional ?? true,
  };
}

function applyConsent(consent: ConsentState) {
  if (typeof window.gtag !== "function") return;
  window.gtag("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
    functionality_storage: consent.functional ? "granted" : "denied",
    security_storage: "granted",
  });
}

function syncConsent() {
  const consent = readConsent();
  window.NizamKitchenConsent = consent;
  applyConsent(consent);
  window.dispatchEvent(new CustomEvent("nizamkitchen:analytics-consent-changed", { detail: consent }));
}

export function SecurePrivacyConsentBridge({
  enabled,
  consentModeEnabled,
}: {
  enabled: boolean;
  consentModeEnabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || !consentModeEnabled) return;

    syncConsent();

    const events = [
      "SecurePrivacyConsentChanged",
      "SecurePrivacyConsentUpdated",
      "secureprivacy_consent_changed",
      "secureprivacy_consent_update",
      "secureprivacy:consent:update",
      "sp_consent_update",
      "sp-consent-updated",
      "cookie_consent_update",
      "CookieConsentDeclaration",
    ];
    const handler = () => syncConsent();
    for (const eventName of events) window.addEventListener(eventName, handler);
    window.addEventListener("storage", handler);
    window.addEventListener("focus", handler);
    const interval = window.setInterval(syncConsent, 2000);

    return () => {
      for (const eventName of events) window.removeEventListener(eventName, handler);
      window.removeEventListener("storage", handler);
      window.removeEventListener("focus", handler);
      window.clearInterval(interval);
    };
  }, [enabled, consentModeEnabled]);

  return null;
}
