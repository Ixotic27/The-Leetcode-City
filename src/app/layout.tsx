import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GlobalRadio from "@/components/GlobalRadio";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  ),
  title: "LeetCode City",
  description:
    "Explore LeetCode users as buildings in a 3D pixel art city. Fly through the city and discover developers.",
  keywords: [
    "leetcode",
    "3d city",
    "developer profile",
    "problems solved",
    "pixel art",
    "competitive programming",
    "leetcode visualization",
  ],
  openGraph: {
    title: "LeetCode City",
    description:
      "Explore LeetCode users as buildings in a 3D pixel art city. Fly through the city and discover developers.",
    siteName: "LeetCode City",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeetCode City",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    creator: "ixotic",
    site: "ixotic",
    images: ["/og-image.png"],
  },
  authors: [{ name: "ixotic", url: "#" }],
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "LeetCode City",
  description:
    "Your LeetCode profile as a 3D pixel art building in an interactive city",
  url: BASE_URL,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  author: {
    "@type": "Person",
    name: "ixotic",
    url: "#",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Silkscreen&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg font-pixel text-warm" suppressHydrationWarning>
        {children}
        <GlobalRadio />
        <Analytics />
        <SpeedInsights />
        {process.env.NEXT_PUBLIC_HIMETRICA_API_KEY && (
          <>
            <Script
              src="https://cdn.himetrica.com/tracker.js"
              data-api-key={process.env.NEXT_PUBLIC_HIMETRICA_API_KEY}
              strategy="afterInteractive"
            />
            <Script
              src="https://cdn.himetrica.com/vitals.js"
              data-api-key={process.env.NEXT_PUBLIC_HIMETRICA_API_KEY}
              strategy="afterInteractive"
            />
            <Script
              src="https://cdn.himetrica.com/errors.js"
              data-api-key={process.env.NEXT_PUBLIC_HIMETRICA_API_KEY}
              strategy="afterInteractive"
            />
          </>
        )}
      </body>
    </html>
  );
}
