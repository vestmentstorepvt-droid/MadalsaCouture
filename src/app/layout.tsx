import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "../legacy-ui/styles/tailwind.css";

// Head tags copied from the original index.html so search and social previews stay the same.
const title = "Madalsa Couture | Timeless Elegance & Contemporary Grace";
const description =
  "Discover the artistry, heritage, and vision behind Madalsa Couture. Premium bespoke tailoring, hand-embroidered detailing, and ethnic luxury wear.";
const ogImage =
  "https://res.cloudinary.com/crond4vx/image/upload/w_1200,h_630,c_fill,f_auto,q_auto/v1786913609/Madalsa/gener/new-product/qgzzukhoavzmc6vf4p9p.webp";
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1078122054657350";

export const metadata: Metadata = {
  title,
  description,
  keywords: "Madalsa, Couture, Fashion, Ethnic Wear, Luxury Clothing, Bespoke Tailoring, Indian Designer",
  authors: [{ name: "Madalsa Atelier" }],
  icons: { icon: "/favicon.webp", apple: "/favicon.webp" },
  openGraph: { type: "website", url: "https://madalsacouture.com/", title, description, images: [ogImage] },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  other: { title },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
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
