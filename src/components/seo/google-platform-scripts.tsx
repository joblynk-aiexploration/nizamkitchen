import Script from "next/script";
import { getGooglePlatformPublicConfig } from "@/server/seo/seo-service";

export async function GooglePlatformScripts() {
  const config = await getGooglePlatformPublicConfig().catch(() => null);

  if (!config) return null;

  const renderAnalytics = config.analyticsEnabled && !config.analyticsConsentRequired && config.analyticsMeasurementId;
  const renderAdsense = config.adsenseEnabled && config.adsensePublisherId;

  return (
    <>
      {renderAnalytics ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${config.analyticsMeasurementId}`} strategy="afterInteractive" />
          <Script id="nizamkitchen-google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${config.analyticsMeasurementId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}
      {renderAdsense ? (
        <Script
          id="nizamkitchen-adsense"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsensePublisherId}`}
        />
      ) : null}
    </>
  );
}
