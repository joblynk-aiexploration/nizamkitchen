import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Playfair_Display } from "next/font/google";
import { SecurePrivacyScripts } from "@/components/privacy/secure-privacy-scripts";
import { SecurePrivacyWidgetCleanup } from "@/components/privacy/secure-privacy-widget-cleanup";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { GooglePlatformScripts } from "@/components/seo/google-platform-scripts";
import { buildSeoMetadata, getGooglePlatformPublicConfig } from "@/server/seo/seo-service";
import "./globals.css";

const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const serif = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [seo, google] = await Promise.all([
    buildSeoMetadata({ path: "/" }),
    getGooglePlatformPublicConfig(),
  ]);

  return {
    ...seo,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "NizamKitchen",
    },
    applicationName: "NizamKitchen",
    verification: google.searchConsoleVerification
      ? { other: { "google-site-verification": google.searchConsoleVerification } }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#0f766e",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--color-app-surface)] text-[var(--color-ink)]">
        <SecurePrivacyScripts />
        <SecurePrivacyWidgetCleanup />
        <PwaRegister />
        {children}
        <GooglePlatformScripts />
      </body>
    </html>
  );
}
