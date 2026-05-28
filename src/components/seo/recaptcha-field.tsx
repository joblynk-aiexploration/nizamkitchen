"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready(callback: () => void): void;
      execute(siteKey: string, options: { action: string }): Promise<string>;
    };
  }
}

export function RecaptchaField({ siteKey, action }: { siteKey?: string | null; action: string }) {
  const [token, setToken] = useState("");

  const requestToken = useCallback(() => {
    if (!siteKey || !window.grecaptcha) return;
    window.grecaptcha.ready(() => {
      window.grecaptcha?.execute(siteKey, { action }).then(setToken).catch(() => setToken(""));
    });
  }, [action, siteKey]);

  useEffect(() => {
    requestToken();
  }, [requestToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
        strategy="afterInteractive"
        onLoad={requestToken}
      />
      <input type="hidden" name="recaptchaToken" value={token} />
    </>
  );
}
