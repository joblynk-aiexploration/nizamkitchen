import Script from "next/script";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { SecurePrivacyConsentBridge } from "@/components/privacy/secure-privacy-consent-bridge";
import { getGooglePlatformPublicConfig } from "@/server/seo/seo-service";

export async function GooglePlatformScripts() {
  const config = await getGooglePlatformPublicConfig().catch(() => null);

  if (!config) return null;

  const analyticsMeasurementId =
    config.analyticsEnabled && config.analyticsMeasurementId
      ? config.analyticsMeasurementId
      : null;
  const renderAdsense = config.adsenseEnabled && config.adsensePublisherId;
  const analyticsRequiresConsent =
    config.analyticsConsentRequired ||
    (config.consentManagementEnabled && config.consentModeEnabled && config.cmpAnalyticsIntegrationEnabled);

  return (
    <>
      <SecurePrivacyConsentBridge
        enabled={config.consentManagementEnabled}
        consentModeEnabled={config.consentModeEnabled}
      />
      {analyticsMeasurementId ? (
        <GoogleAnalytics measurementId={analyticsMeasurementId} requiresConsent={analyticsRequiresConsent} />
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
