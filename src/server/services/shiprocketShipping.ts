// @ts-nocheck — same loose typing as the ported services it works with.
import __imp0 from "@/server/config/logger";
import { Order, OrderItem, Product, User } from "@/server/models/registry";

const logger = __imp0;

/**
 * Shiprocket shipping panel (apiv2.shiprocket.in): puts shop orders into the panel so a courier
 * can be booked, and cancels them there.
 *
 * Shiprocket Checkout orders do NOT reach the shipping panel by themselves (checked: the panel had
 * none), so each order is created there by us — pickup from the account's pickup location, drop at
 * the customer's address.
 *
 * Timing: an order becomes due SHIPROCKET_SHIP_DELAY_MINUTES after it's placed (0 while testing;
 * 60 before going live). Until then a cancel stays inside the shop. `createDueShipments()` runs
 * every few minutes while the server is up and whenever an order webhook arrives.
 *
 * Env: SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD (the API user), optional SHIPROCKET_PICKUP_LOCATION
 * (default: the account's primary one), SHIPROCKET_PACKAGE "weightKg,lengthCm,breadthCm,heightCm"
 * (default "0.5,30,25,5"), SHIPROCKET_CONTACT_EMAIL for orders with no customer email.
 */

const API = "https://apiv2.shiprocket.in/v1/external";

const configured = () => !!((process.env.SHIPROCKET_EMAIL || "").trim() && (process.env.SHIPROCKET_PASSWORD || "").trim());

/** Like the catalog sync: only the live server writes to Shiprocket (SHIPROCKET_SYNC=on|off overrides). */
const allowedHere = () => {
  const flag = (process.env.SHIPROCKET_SYNC || "").trim().toLowerCase();
  return flag === "on" || (flag !== "off" && process.env.NODE_ENV === "production");
};

export const shipDelayMinutes = () => Math.max(0, Number(process.env.SHIPROCKET_SHIP_DELAY_MINUTES) || 0);

// Tokens last 10 days; refresh after 9.
let token = null;
let tokenUntil = 0;

async function authToken() {
  if (token && Date.now() < tokenUntil) return token;
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL.trim(), password: process.env.SHIPROCKET_PASSWORD.trim() }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) throw new Error(`Shiprocket login failed (HTTP ${res.status}): ${body.message || "no token"}`);
  token = body.token;
  tokenUntil = Date.now() + 9 * 24 * 60 * 60 * 1000;
  return token;
}

async function api(method, path, payload) {
  const send = async () =>
    fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await authToken()}` },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  let res = await send();
  if (res.status === 401) {
    token = null; // expired early: log in again once
    res = await send();
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.message || (body.errors ? JSON.stringify(body.errors) : JSON.stringify(body).slice(0, 300));
    throw Object.assign(new Error(`Shiprocket ${method} ${path} failed (HTTP ${res.status}): ${detail}`), { status: res.status, body });
  }
  return body;
}

let pickupName = null;
async function pickupLocation() {
  if (process.env.SHIPROCKET_PICKUP_LOCATION) return process.env.SHIPROCKET_PICKUP_LOCATION.trim();
  if (pickupName) return pickupName;
  const body = await api("GET", "/settings/company/pickup");
  const list = body.data?.shipping_address || [];
  const primary = list.find((a) => Number(a.is_primary_location) === 1) || list[0];
  if (!primary) throw new Error("No pickup location set up in Shiprocket");
  pickupName = primary.pickup_location;
  return pickupName;
}

async function stateForPincode(pincode) {
  if (!pincode) return null;
  try {
    const body = await api("GET", `/open/postcode/details?postcode=${encodeURIComponent(pincode)}`);
    return body.postcode_details?.state || null;
  } catch {
    return null;
  }
}

function packageSize(items, products) {
  const [w, l, b, h] = String(process.env.SHIPROCKET_PACKAGE || "0.5,30,25,5").split(",").map(Number);
  // Use product weights when the shop has them, else the default per piece.
  let weight = 0;
  for (const item of items) {
    const perPiece = Number(products.get(String(item.productId))?.shipping?.weight) || w;
    weight += perPiece * item.quantity;
  }
  return { weight: Math.max(0.1, Number(weight.toFixed(2))), length: l, breadth: b, height: h };
}

const pad = (n) => String(n).padStart(2, "0");
const shiprocketDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Create one order in the shipping panel. Records the result (or the error) on the order. */
export async function createShippingOrder(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order || order.shiprocketShipping?.orderId) return order?.shiprocketShipping || null;
  if (order.status === "Cancelled") return null;

  try {
    const items = await OrderItem.find({ orderId: order._id }).lean();
    const products = new Map();
    for (const item of items) {
      if (item.productId && !products.has(String(item.productId))) {
        products.set(String(item.productId), await Product.findById(item.productId).lean());
      }
    }
    const user = order.userId ? await User.findById(order.userId).lean() : null;
    const a = order.shippingAddress || {};
    const [firstName, ...rest] = String(a.name || "Customer").trim().split(/\s+/);
    const state = a.state || (await stateForPincode(a.pincode));
    const size = packageSize(items, products);

    const payload = {
      order_id: order.orderNumber,
      order_date: shiprocketDate(new Date(order.createdAt || Date.now())),
      pickup_location: await pickupLocation(),
      billing_customer_name: firstName,
      billing_last_name: rest.join(" "),
      billing_address: a.addressLine || "",
      billing_city: a.city || "",
      billing_pincode: a.pincode || "",
      billing_state: state || "",
      billing_country: a.country || "India",
      billing_email: user?.email || order.guestEmail || process.env.SHIPROCKET_CONTACT_EMAIL || "support@madalsacouture.com",
      billing_phone: a.phone || user?.phone || "",
      shipping_is_billing: true,
      order_items: items.map((item) => ({
        name: [item.productTitle, item.size, item.color].filter(Boolean).join(" / "),
        sku: item.sku || String(item.variantId || item.productId),
        units: item.quantity,
        selling_price: item.unitPrice,
        hsn: products.get(String(item.productId))?.hsnCode || "",
      })),
      payment_method: order.paymentMethod === "online" ? "Prepaid" : "COD",
      shipping_charges: order.shippingCharge || 0,
      total_discount: order.discountAmount || 0,
      sub_total: order.subtotal,
      ...size,
    };

    const res = await api("POST", "/orders/create/adhoc", payload);
    const shipping = {
      orderId: res.order_id,
      shipmentId: res.shipment_id ?? null,
      status: res.status || "NEW",
      awb: res.awb_code || null,
      courier: res.courier_name || null,
      createdAt: new Date(),
      error: null,
    };
    await Order.updateOne({ _id: order._id }, { $set: { shiprocketShipping: shipping } });
    logger.info(`[Shiprocket shipping] ${order.orderNumber} → shipping order ${shipping.orderId} (shipment ${shipping.shipmentId})`);
    return shipping;
  } catch (err) {
    await Order.updateOne({ _id: order._id }, { $set: { "shiprocketShipping.error": err.message, "shiprocketShipping.lastTriedAt": new Date() } });
    throw err;
  }
}

/** Create shipping orders for every order that is due and not yet in the panel. */
export async function createDueShipments() {
  if (!configured() || !allowedHere()) return { created: 0, failed: 0 };
  const dueBefore = new Date(Date.now() - shipDelayMinutes() * 60 * 1000);
  const candidates = await Order.find({ source: "shiprocket", isDeleted: false }).lean();
  let created = 0;
  let failed = 0;
  for (const order of candidates) {
    if (order.shiprocketShipping?.orderId || order.status === "Cancelled") continue;
    if (new Date(order.createdAt) > dueBefore) continue; // still inside the cancel window
    try {
      await createShippingOrder(order._id);
      created++;
    } catch (err) {
      failed++;
      logger.error(`[Shiprocket shipping] ${order.orderNumber}: ${err.message}`);
    }
  }
  return { created, failed };
}

/**
 * Cancel an order's shipping-panel order before the shop marks it Cancelled.
 * Not in the panel yet (inside the delay) → nothing to do. Courier already assigned → refused (409).
 */
export async function cancelShippingOrder(order) {
  const srOrderId = order.shiprocketShipping?.orderId;
  if (!srOrderId) return;
  if (!configured()) throw Object.assign(new Error("Shiprocket shipping isn't configured"), { statusCode: 503 });

  const current = await api("GET", `/orders/show/${srOrderId}`);
  const awb = current.data?.shipments?.awb || current.data?.awb_data?.awb || null;
  if (awb) {
    throw Object.assign(new Error("This order has already been handed to the courier and can't be cancelled here. Please contact support."), {
      statusCode: 409,
      code: "ORDER_ALREADY_SHIPPED",
    });
  }
  if (String(current.data?.status || "").toUpperCase() !== "CANCELED") {
    await api("POST", "/orders/cancel", { ids: [srOrderId] });
  }
  await Order.updateOne({ _id: order._id }, { $set: { "shiprocketShipping.status": "CANCELED", "shiprocketShipping.cancelledAt": new Date() } });
  logger.info(`[Shiprocket shipping] Cancelled shipping order ${srOrderId} for ${order.orderNumber}`);
}

// While the server is up, check for due orders every 5 minutes.
const g = globalThis;
if (!g.__shiprocketShipTimer && typeof setInterval === "function") {
  g.__shiprocketShipTimer = setInterval(() => {
    createDueShipments().catch((err) => logger.error(`[Shiprocket shipping] Due check failed: ${err.message}`));
  }, 5 * 60 * 1000);
  g.__shiprocketShipTimer.unref?.();
}
