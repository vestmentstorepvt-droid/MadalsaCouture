// @ts-nocheck — ported from the Express backend (services/metaConversionsService.js); logic unchanged.
import __imp0 from "axios";
import __imp1 from "@/server/config/urls";
import * as __imp2 from "node:crypto";
import __imp3 from "@/server/config/logger";

/**
 * Meta Conversions API (CAPI) Service
 *
 * Sends server-side events directly to Meta to improve ad measurement accuracy.
 * Works alongside the browser Meta Pixel — Meta deduplicates them automatically
 * using the event_id field (set by the caller).
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * Security:
 *  - META_ACCESS_TOKEN must remain a backend-only environment variable.
 *    It is never returned to the client, logged, or included in responses.
 *  - All PII (email, phone, name) is SHA-256 hashed before transmission.
 *  - Errors from this service never propagate to callers — CAPI failures
 *    must not affect the customer checkout experience.
 */

const axios = __imp0;
const { FRONTEND_URL } = __imp1;
const crypto = __imp2;
const logger = __imp3;

// ─── Configuration ─────────────────────────────────────────────────────────────

const PIXEL_ID     = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const API_VERSION  = 'v21.0';
const CAPI_URL     = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

// Optional test event code — set META_TEST_EVENT_CODE=TEST12345 in .env
// while verifying events in Meta Events Manager → Test Events tab.
// Never set this in production.
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Hash a value with SHA-256 as required by Meta for all PII.
 * Trims and lowercases the string before hashing (Meta requirement).
 * Returns undefined if the value is falsy so callers don't send null fields.
 *
 * @param {string|number|undefined|null} value
 * @returns {string|undefined}
 */
function hashData(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return crypto
    .createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

/**
 * Normalize an Indian phone number to E.164 format (digits only, no country
 * code prefix, 10 digits) before hashing. Meta expects normalized values.
 *
 * @param {string|undefined|null} phone
 * @returns {string|undefined}
 */
function normalizePhone(phone) {
  if (!phone) return undefined;
  // Meta matches phone numbers WITH the country code, digits only ("919876543210").
  // Indian numbers are stored as 10 digits, so add 91.
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? `91${digits.slice(-10)}` : undefined;
}

/** Meta's _fbp / _fbc cookie format ("fb.1.<time>.<id>"); anything else is dropped. */
function metaCookie(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return /^fb\.\d\.\d+\.[\w.-]{1,250}$/.test(v) ? v : undefined;
}

/** City / postcode / country as Meta wants them before hashing: lower case, letters and digits only. */
function compact(value) {
  if (!value) return undefined;
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '') || undefined;
}

/**
 * Extract user-data fields from the Express request and any caller-provided
 * user object. Reads _fbc/_fbp from cookies (set by the browser pixel) to
 * improve Event Match Quality.
 *
 * Fields that are absent or empty are omitted entirely (Meta ignores null
 * fields but explicit nulls can trigger validation warnings).
 *
 * @param {import('express').Request} req
 * @param {{ email?, phone?, firstName?, lastName?, fbc?, fbp? }} [userData]
 * @returns {object} Meta user_data payload
 */
function buildUserData(req, userData = {}) {
  // IP: req.ip comes from the hosting platform's trusted header (api route clientIp), so it
  // can't be faked with X-Forwarded-For. Server-to-server calls (the Shiprocket order webhook)
  // pass the shopper's IP and browser that were saved when checkout opened.
  const rawIp = userData.ip || req?.ip || undefined;
  const userAgent = userData.userAgent || req?.headers?.['user-agent'] || undefined;

  // _fbc and _fbp are cookies the Meta pixel sets on the shop's domain. The API runs on another
  // domain, so the browser forwards them in x-meta-fbp / x-meta-fbc headers (api/baseQuery.ts).
  const fbc = metaCookie(userData.fbc) || metaCookie(req?.headers?.['x-meta-fbc']) || metaCookie(req?.cookies?.['_fbc']);
  const fbp = metaCookie(userData.fbp) || metaCookie(req?.headers?.['x-meta-fbp']) || metaCookie(req?.cookies?.['_fbp']);

  const result = {};

  // Non-PII device signals (not hashed)
  if (rawIp)    result.client_ip_address  = rawIp;
  if (userAgent) result.client_user_agent = userAgent;
  if (fbc)       result.fbc               = fbc;
  if (fbp)       result.fbp               = fbp;

  // Hashed PII — normalize phone before hashing
  const hashedEmail = hashData(userData.email);
  const hashedPhone = hashData(normalizePhone(userData.phone));
  const hashedFn    = hashData(userData.firstName);
  const hashedLn    = hashData(userData.lastName);

  if (hashedEmail) result.em = hashedEmail;
  if (hashedPhone) result.ph = hashedPhone;
  if (hashedFn)    result.fn = hashedFn;
  if (hashedLn)    result.ln = hashedLn;

  const hashedCity    = hashData(compact(userData.city));
  const hashedZip     = hashData(compact(userData.zip));
  const hashedCountry = hashData(compact(userData.country));
  const hashedId      = hashData(userData.externalId);
  if (hashedCity)    result.ct = hashedCity;
  if (hashedZip)     result.zp = hashedZip;
  if (hashedCountry) result.country = hashedCountry;
  if (hashedId)      result.external_id = hashedId;

  return result;
}

/**
 * Send one or more events to the Meta Conversions API.
 * Never throws — errors are logged via Winston and swallowed so that a CAPI
 * failure never impacts the customer-facing checkout flow.
 *
 * @param {object[]} events - Array of Meta CAPI event objects.
 * @returns {Promise<void>}
 */
async function sendEvent(events) {
  // Guard: skip silently if credentials are missing or still placeholder.
  if (
    !PIXEL_ID ||
    !ACCESS_TOKEN ||
    ACCESS_TOKEN === 'PASTE_YOUR_META_ACCESS_TOKEN_HERE'
  ) {
    logger.warn('[MetaCAPI] Skipping — META_ACCESS_TOKEN is not configured. Set it in .env to activate server-side tracking.');
    return;
  }

  const payload = { data: events };
  if (TEST_EVENT_CODE) {
    payload.test_event_code = TEST_EVENT_CODE;
    logger.info(`[MetaCAPI] TEST MODE active (code: ${TEST_EVENT_CODE}). Events will appear in Meta Test Events tab only.`);
  }

  try {
    const response = await axios.post(CAPI_URL, payload, {
      params:  { access_token: ACCESS_TOKEN },
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000, // 5 s — never block the checkout response
    });

    // Log event names only; never log access tokens or payload PII
    const names = events.map((e) => e.event_name).join(', ');
    logger.info(`[MetaCAPI] Sent event(s): ${names} | events_received: ${response.data?.events_received ?? '?'}`);
  } catch (err) {
    // Log structured error info without exposing the access token.
    // err.config.params would contain the token — never log the whole config.
    const status  = err?.response?.status;
    const errData = err?.response?.data;
    if (status) {
      logger.error(`[MetaCAPI] HTTP ${status} from Meta Graph API: ${JSON.stringify(errData)}`);
    } else {
      logger.error(`[MetaCAPI] Network error sending event: ${err.message}`);
    }
  }
}

// ─── Public Event Helpers ──────────────────────────────────────────────────────

/**
 * Track a Purchase event (most important for ad ROI measurement).
 *
 * This should be called server-side immediately after an order is confirmed.
 *
 * The caller must supply the same eventId that was used in the browser-side
 * fbq('track', 'Purchase', ..., { eventID }) call so Meta can deduplicate.
 *
 * @param {import('express').Request} req        - Express request (for IP/UA)
 * @param {{ orderId, value, currency?, items?, user? }} orderData
 * @param {string} eventId  - Shared ID for Pixel/CAPI deduplication
 * @returns {Promise<void>}
 */
async function trackPurchase(req, orderData, eventId) {
  const { orderId, value, currency = 'INR', items = [], user = {}, eventTime, sourcePath = '/order-success' } = orderData;

  const event = {
    event_name:       'Purchase',
    event_time:       Math.floor((eventTime ? new Date(eventTime).getTime() : Date.now()) / 1000),
    event_id:         eventId,
    event_source_url: `${FRONTEND_URL}${sourcePath}`,
    action_source:    'website',
    user_data:        buildUserData(req, user),
    custom_data: {
      currency,
      value:        Number(value),
      order_id:     String(orderId),
      content_type: 'product',
      contents:     items.map((item) => ({
        id:         String(item.productId || item._id),
        quantity:   item.quantity,
        item_price: item.unitPrice ?? item.price ?? 0,
      })),
    },
  };

  return sendEvent([event]);
}

/**
 * Track an AddToCart event.
 * Wire this up from the cart controller (POST /api/v1/cart/items) if you
 * want server-side AddToCart events. Browser-side fbq AddToCart can be used
 * independently without CAPI for this event type if the data is not critical.
 *
 * @param {import('express').Request} req
 * @param {{ productId, productName, price, currency?, user? }} cartData
 * @param {string} eventId  - Shared ID for Pixel/CAPI deduplication
 * @returns {Promise<void>}
 */
async function trackAddToCart(req, cartData, eventId) {
  const { productId, productName, price, currency = 'INR', user = {} } = cartData;

  const event = {
    event_name:       'AddToCart',
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         eventId,
    event_source_url: `${FRONTEND_URL}/products/${productId}`,
    action_source:    'website',
    user_data:        buildUserData(req, user),
    custom_data: {
      currency,
      value:        Number(price),
      content_ids:  [String(productId)],
      content_name: productName,
      content_type: 'product',
    },
  };

  return sendEvent([event]);
}

/**
 * Track an InitiateCheckout event.
 * Wire this up from your backend if you have a server-side checkout-session
 * endpoint. If checkout is purely client-side, use the browser pixel instead.
 *
 * @param {import('express').Request} req
 * @param {{ totalValue, currency?, numItems?, user? }} checkoutData
 * @param {string} eventId  - Shared ID for Pixel/CAPI deduplication
 * @returns {Promise<void>}
 */
async function trackInitiateCheckout(req, checkoutData, eventId) {
  const { totalValue, currency = 'INR', numItems = 1, user = {} } = checkoutData;

  const event = {
    event_name:       'InitiateCheckout',
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         eventId,
    event_source_url: `${FRONTEND_URL}/checkout`,
    action_source:    'website',
    user_data:        buildUserData(req, user),
    custom_data: {
      currency,
      value:    Number(totalValue),
      num_items: numItems,
    },
  };

  return sendEvent([event]);
}

/**
 * Track a Lead event (e.g. newsletter signup, contact form submission).
 *
 * @param {import('express').Request} req
 * @param {{ user? }} leadData
 * @param {string} eventId
 * @returns {Promise<void>}
 */
async function trackLead(req, leadData, eventId) {
  const { user = {} } = leadData;

  const event = {
    event_name:       'Lead',
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         eventId,
    event_source_url: FRONTEND_URL,
    action_source:    'website',
    user_data:        buildUserData(req, user),
  };

  return sendEvent([event]);
}

/**
 * Track a ViewContent event (product page viewed).
 *
 * @param {import('express').Request} req
 * @param {{ productId, productName, price, currency?, category?, user? }} viewData
 * @param {string} eventId
 * @returns {Promise<void>}
 */
async function trackViewContent(req, viewData, eventId) {
  const { productId, productName, price, currency = 'INR', category, user = {} } = viewData;

  const event = {
    event_name:       'ViewContent',
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         eventId,
    event_source_url: `${FRONTEND_URL}/product/${productId}`,
    action_source:    'website',
    user_data:        buildUserData(req, user),
    custom_data: {
      currency,
      value:         Number(price) || 0,
      content_ids:   [String(productId)],
      content_name:  productName,
      content_type:  'product',
      ...(category ? { content_category: category } : {}),
    },
  };

  return sendEvent([event]);
}

/**
 * Track a Search event (user searched for products).
 *
 * @param {import('express').Request} req
 * @param {{ searchString, user? }} searchData
 * @param {string} eventId
 * @returns {Promise<void>}
 */
async function trackSearch(req, searchData, eventId) {
  const { searchString, user = {} } = searchData;

  const event = {
    event_name:       'Search',
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         eventId,
    event_source_url: `${FRONTEND_URL}/products`,
    action_source:    'website',
    user_data:        buildUserData(req, user),
    custom_data: {
      search_string: String(searchString),
    },
  };

  return sendEvent([event]);
}

/**
 * Track a CompleteRegistration event (new user signed up).
 *
 * @param {import('express').Request} req
 * @param {{ user? }} regData
 * @param {string} eventId
 * @returns {Promise<void>}
 */
async function trackCompleteRegistration(req, regData, eventId) {
  const { user = {} } = regData;

  const event = {
    event_name:       'CompleteRegistration',
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         eventId,
    event_source_url: `${FRONTEND_URL}/signup`,
    action_source:    'website',
    user_data:        buildUserData(req, user),
    custom_data: {
      status: 'success',
    },
  };

  return sendEvent([event]);
}

const __exports: any = {
  trackPurchase,
  trackAddToCart,
  trackInitiateCheckout,
  trackLead,
  trackViewContent,
  trackSearch,
  trackCompleteRegistration,
  // Expose hash helper so tests can assert correct hashing without calling the full API
  _hashData: hashData,
  _normalizePhone: normalizePhone,
  _buildUserData: buildUserData,
};


export default __exports;
