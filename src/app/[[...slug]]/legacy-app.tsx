"use client";

import dynamic from "next/dynamic";

// The copied website uses browser-only APIs (createBrowserRouter, localStorage via redux-persist),
// so it is loaded only in the browser — exactly how it ran under Vite.
const App = dynamic(() => import("@/legacy-ui/App"), { ssr: false });

export function LegacyApp() {
  return (
    <div id="root">
      <App />
    </div>
  );
}
