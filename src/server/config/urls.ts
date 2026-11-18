// @ts-nocheck — ported from the Express backend (config/urls.js); logic unchanged.


/**
 * Centralised URL config.
 *
 * All URL env vars fall back to their NODE_ENV-appropriate defaults so the
 * app works out-of-the-box in development (localhost) and only requires the
 * env vars to be set explicitly in production.
 *
 * Priority: explicit env var → NODE_ENV default
 */

const isDev = process.env.NODE_ENV !== 'production';

/** Public URL of this backend server (no trailing slash). */
const APP_URL =
  process.env.APP_URL || (isDev ? 'http://localhost:5000' : 'https://madalsacouture.com');

/** Public URL of the frontend app (no trailing slash). */
const FRONTEND_URL =
  process.env.FRONTEND_URL || (isDev ? 'http://localhost:5173' : 'https://madalsacouture.com');

/**
 * Frontend base URL used in Shiprocket's redirect_url.
 * In development Shiprocket cannot reach localhost, so this defaults to the
 * production URL even in dev — override with APP_FRONTEND_URL in .env if you
 * have a publicly accessible tunnel (ngrok, Cloudflare Tunnel, etc.).
 */
const APP_FRONTEND_URL =
  process.env.APP_FRONTEND_URL || 'https://madalsacouture.com';

const __exports: any = { APP_URL, FRONTEND_URL, APP_FRONTEND_URL };

export default __exports;
