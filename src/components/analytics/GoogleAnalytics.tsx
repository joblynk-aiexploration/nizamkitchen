import Script from "next/script";
import { Suspense } from "react";
import { GoogleAnalyticsTracker } from "@/components/seo/google-analytics-tracker";

type GoogleAnalyticsProps = {
  measurementId?: string | null;
  requiresConsent: boolean;
};

export function GoogleAnalytics({ measurementId, requiresConsent }: GoogleAnalyticsProps) {
  if (!measurementId) return null;

  const measurementIdJson = JSON.stringify(measurementId);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="nizamkitchen-google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.NizamKitchenAnalyticsMeasurementId = ${measurementIdJson};
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', ${measurementIdJson}, { anonymize_ip: true, send_page_view: true });
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsTracker measurementId={measurementId} requiresConsent={requiresConsent} />
      </Suspense>
    </>
  );
}
