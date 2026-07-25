import Script from "next/script";
import { getSecurePrivacyPublicConfig } from "@/server/seo/seo-service";

export async function SecurePrivacyScripts() {
  const config = await getSecurePrivacyPublicConfig().catch(() => null);

  if (!config?.enabled || !config.scriptUrl) return null;

  return (
    <>
      {config.consentModeEnabled ? (
        <Script
          id="nizamkitchen-google-consent-default"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                functionality_storage: 'granted',
                security_storage: 'granted'
              });
              window.NizamKitchenConsentModeEnabled = true;
            `,
          }}
        />
      ) : null}
      <Script
        id="nizamkitchen-secure-privacy"
        src={config.scriptUrl}
        strategy="afterInteractive"
        async
        data-nizamkitchen-provider="secure_privacy"
      />
    </>
  );
}
