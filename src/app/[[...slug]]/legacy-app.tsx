"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The copied website uses browser-only APIs (createBrowserRouter, localStorage via redux-persist),
// so it is loaded only in the browser — exactly how it ran under Vite.
const App = dynamic(() => import("@/legacy-ui/App"), { ssr: false });

/**
 * `children` is the server-rendered page summary for crawlers (see src/seo/SeoSummary.tsx).
 * It is part of the first HTML only and is dropped once the real website has mounted.
 */
export function LegacyApp({ children }: { children?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time switch after hydration
  useEffect(() => setMounted(true), []);
  return (
    <>
      {mounted ? null : children}
      <div id="root">
        <App />
      </div>
    </>
  );
}
