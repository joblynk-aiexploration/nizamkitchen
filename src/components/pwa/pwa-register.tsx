"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const shouldRegister = process.env.NODE_ENV === "production" && !isLocalhost;
    const networkOnlyPrefixes = [
      "/admin",
      "/api",
      "/settings",
      "/dashboard",
      "/billing",
      "/notifications",
      "/support",
      "/profile",
      "/orders",
      "/catering",
      "/restaurant",
      "/chef",
      "/household",
    ];
    const isAuthenticatedArea = networkOnlyPrefixes.some((prefix) => window.location.pathname.startsWith(prefix));

    if (!shouldRegister || isAuthenticatedArea) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA registration should never interrupt the cooking or shopping flows.
    });
  }, []);

  return null;
}
