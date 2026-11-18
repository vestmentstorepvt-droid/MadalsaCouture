import { LegacyApp } from "./legacy-app";

// Every non-API URL renders the original React website, which handles its own routing in the browser.
export default function Page() {
  return <LegacyApp />;
}
