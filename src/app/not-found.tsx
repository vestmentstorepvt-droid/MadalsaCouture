import type { Metadata } from "next";
import { LegacyApp } from "./[[...slug]]/legacy-app";

// Unknown URLs now answer with a real 404 status (and "noindex") instead of a 200 copy of the
// home page. Visitors still get the website, which handles the unknown address as before.
export const metadata: Metadata = { title: "Page not found | Madalsa Couture" }; // "noindex" is added by Next.js

export default function NotFound() {
  return <LegacyApp />;
}
