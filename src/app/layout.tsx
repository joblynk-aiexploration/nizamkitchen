import type { Metadata } from "next";
import { IBM_Plex_Sans, Playfair_Display } from "next/font/google";
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
  title: "NizamKitchen SaaS Foundation",
  description: "Enterprise multi-tenant SaaS foundation for NizamKitchen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--color-app-surface)] text-[var(--color-ink)]">
        {children}
      </body>
    </html>
  );
}
