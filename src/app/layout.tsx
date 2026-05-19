import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Playfair_Display } from "next/font/google";
import { PwaRegister } from "@/components/pwa/pwa-register";
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

export const metadata: Metadata = {
  title: "Nizam Kitchen",
  description: "Hyderabadi meal planning, grocery lists, and household cooking workflows for NizamKitchen beta users.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NizamKitchen",
  },
  applicationName: "NizamKitchen",
};

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
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--color-app-surface)] text-[var(--color-ink)]">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
