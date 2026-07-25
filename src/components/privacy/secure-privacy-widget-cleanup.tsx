"use client";

import { useEffect } from "react";

const FLOATING_WIDGET_MAX_SIZE = 140;
const FLOATING_WIDGET_EDGE_GAP = 140;
const SECURE_PRIVACY_FLOATING_WIDGET_IDS = ["ifrmCookieBanner", "ifrmTrustBadge"];

function isSmallBottomLeftWidget(rect: DOMRect) {
  if (rect.width <= 0 || rect.height <= 0) return false;

  const bottomGap = window.innerHeight - rect.bottom;

  return (
    rect.width <= FLOATING_WIDGET_MAX_SIZE &&
    rect.height <= FLOATING_WIDGET_MAX_SIZE &&
    rect.left <= FLOATING_WIDGET_EDGE_GAP &&
    bottomGap <= FLOATING_WIDGET_EDGE_GAP
  );
}

function updateSecurePrivacyLauncherVisibility() {
  for (const iframeId of SECURE_PRIVACY_FLOATING_WIDGET_IDS) {
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    if (!iframe) continue;

    const shouldHide = isSmallBottomLeftWidget(iframe.getBoundingClientRect());

    if (shouldHide) {
      iframe.style.visibility = "hidden";
      iframe.style.pointerEvents = "none";
      iframe.dataset.nizamkitchenHiddenLauncher = "true";
      continue;
    }

    if (iframe.dataset.nizamkitchenHiddenLauncher === "true") {
      iframe.style.visibility = "";
      iframe.style.pointerEvents = "";
      delete iframe.dataset.nizamkitchenHiddenLauncher;
    }
  }
}

export function SecurePrivacyWidgetCleanup() {
  useEffect(() => {
    let animationFrame = 0;

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateSecurePrivacyLauncherVisibility);
    };

    scheduleUpdate();

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      subtree: true,
    });

    const interval = window.setInterval(updateSecurePrivacyLauncherVisibility, 1000);
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearInterval(interval);
      window.removeEventListener("resize", scheduleUpdate);
      observer.disconnect();
    };
  }, []);

  return null;
}
