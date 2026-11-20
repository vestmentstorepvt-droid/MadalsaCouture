import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Cormorant_Garamond, Geist, Geist_Mono, Great_Vibes } from "next/font/google";
import "../legacy-ui/styles/tailwind.css";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/seo/config";

// Head tags copied from the original index.html so search and social previews stay the same.
const title = "Madalsa Couture | Timeless Elegance & Contemporary Grace";
const description =
  "Discover the artistry, heritage, and vision behind Madalsa Couture. Premium bespoke tailoring, hand-embroidered detailing, and ethnic luxury wear.";
const ogImage = DEFAULT_OG_IMAGE;
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
// Display pair for the home-page collection banners only (script word + serif capitals).
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-cormorant", display: "swap" });
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-great-vibes", display: "swap" });
const pixelId =process.env.NEXT_PUBLIC_META_PIXEL_ID || "1078122054657350";
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "").origin;
  } catch {
    return null; // empty = same host as the site, nothing to preconnect
  }
})();

// Site-wide defaults; every storefront page sets its own title, description and canonical
// (src/app/[[...slug]]/page.tsx).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  icons: { icon: "/favicon.webp", apple: "/favicon.webp" },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", url: `${SITE_URL}/`, title, description, images: [ogImage] },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fafafa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${script.variable}`}>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        {/* The API is on another host: connect while the page's JavaScript is still loading, so
            the first product request doesn't also pay for DNS + TLS (slow on mobile networks).
            crossOrigin matches the API's CORS fetches, otherwise the browser can't reuse it. */}
        {apiOrigin ? <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" /> : null}
      </head>
      <body suppressHydrationWarning>
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{ display: "none" }} alt=""
            src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
        </noscript>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        {children}
      </body>
    </html>
  );
}
