"use client";

import { SlidersHorizontal } from "lucide-react";

type SecurePrivacyApi = {
  openPreferences?: () => void;
  showPreferences?: () => void;
  openSettings?: () => void;
  showSettings?: () => void;
  openCookieSettings?: () => void;
  reopenBanner?: () => void;
};

declare global {
  interface Window {
    SecurePrivacy?: SecurePrivacyApi;
    securePrivacy?: SecurePrivacyApi;
    sp?: SecurePrivacyApi;
  }
}

function openSecurePrivacyPreferences() {
  const candidates = [window.SecurePrivacy, window.securePrivacy, window.sp].filter(Boolean) as SecurePrivacyApi[];
  const methodNames: Array<keyof SecurePrivacyApi> = [
    "openPreferences",
    "showPreferences",
    "openSettings",
    "showSettings",
    "openCookieSettings",
    "reopenBanner",
  ];

  for (const candidate of candidates) {
    for (const methodName of methodNames) {
      const method = candidate[methodName];
      if (typeof method === "function") {
        method.call(candidate);
        return;
      }
    }
  }

  window.dispatchEvent(new CustomEvent("secureprivacy:open-preferences"));
}

export function ManageCookiePreferencesButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openSecurePrivacyPreferences}
      className={className}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      Manage Cookie Preferences
    </button>
  );
}
