/**
 * The Meta pixel's own cookies (_fbp = this browser, _fbc = the ad click it came from).
 * The API runs on a different domain and never sees these cookies, so they are forwarded as
 * headers; the server adds them to Conversions API events so Meta can match sales to ad clicks.
 */
export function metaCookieHeaders(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const headers: Record<string, string> = {};
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    const value = rest.join('=');
    if (!value) continue;
    if (name === '_fbp') headers['x-meta-fbp'] = value;
    if (name === '_fbc') headers['x-meta-fbc'] = value;
  }
  return headers;
}
