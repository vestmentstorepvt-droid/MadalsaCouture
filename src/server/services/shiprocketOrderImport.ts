// @ts-nocheck — same loose typing as the ported services it works with.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/config/logger";
import { AdminNotification, Order, OrderItem, Product, ShiprocketOrder, User, Variant } from "@/server/models/registry";
import { queueShiprocketSync, shiprocketVariantId } from "@/server/services/shiprocketCatalog";
import { createDueShipments } from "@/server/services/shiprocketShipping";
import variantService from "@/server/services/variantService";
import cartService from "@/server/services/cartService";

const mongoose = __imp0;
const logger = __imp1;

/**
 * Turns a Shiprocket Checkout "Order Placed" webhook into a shop order, so it shows in
 * Admin → Orders and the customer's "My orders".
 *
 * Payload (observed on a real order): cart_id, latest_stage "ORDER_PLACED", items[{ product_id,
 * variant_id (our catalog's numeric ids), title, price, quantity }], total_price (before discount),
 * total_discount, shipping_price, tax, currency, shipping_address / billing_address { first_name,
 * last_name, name, phone, address1, address2, city, zip, country }, created_at.
 * It carries no payment type or email: the account currently only offers COD, so orders are
 * recorded as COD until Shiprocket sends a payment type.
 *
 * Safe to run twice: an order is keyed by its Shiprocket cart_id (Order.shiprocketOrderId is unique).
 */

const digits = (s) => String(s || "").replace(/\D/g, "").slice(-10);

/** Our variants (any state) by the numeric id Shiprocket uses. Small table; loaded per import. */
async function variantsByShiprocketId() {
  const rows = await Variant.find({}).lean();
  return new Map(rows.map((v) => [shiprocketVariantId(v._id), v]));
}

/** Next MC-YYYY-NNNNN number, from the same counter the shop's own checkout uses. */
async function nextOrderNumber() {
  const counter = await mongoose.connection.db
    .collection("counters")
    .findOneAndUpdate({ _id: "order_number" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return `MC-${new Date().getFullYear()}-${String(counter.seq).padStart(5, "0")}`;
}

/** Shiprocket address → the shop's shippingAddress shape. */
function toShippingAddress(a = {}) {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || a.name || "Customer";
  return {
    name,
    addressLine: [a.address1, a.address2].filter(Boolean).join(", "),
    city: a.city || null,
    state: a.state || a.province || null,
    pincode: a.zip || a.pincode || null,
    country: a.country || "India",
    phone: digits(a.phone) || null,
    deliveryPhone: null,
  };
}

/**
 * Create the shop order for one stored webhook delivery (a `shiprocketorders` row of kind "order").
 * Returns the order, or null when the delivery isn't a placed order.
 */
export async function importShiprocketOrder(delivery) {
  const p = delivery.payload || {};
  const cartId = p.cart_id ? String(p.cart_id) : null;
  if (!cartId || String(p.latest_stage || "").toUpperCase() !== "ORDER_PLACED") return null;

  const existing = await Order.findOne({ shiprocketOrderId: cartId }).lean();
  if (existing) {
    await ShiprocketOrder.updateOne({ _id: delivery._id }, { $set: { processed: true, shopOrderId: existing._id } });
    return existing;
  }

  // Items: Shiprocket sends our catalog's numeric variant ids.
  const variants = await variantsByShiprocketId();
  const snapshots = [];
  for (const item of p.items || []) {
    const variant = variants.get(Number(item.variant_id));
    const product = variant ? await Product.findById(variant.productId).lean() : null;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = Number(item.price) || 0;
    snapshots.push({
      productId: product?._id ?? null,
      variantId: variant?._id ?? null,
      productTitle: product?.title || item.title || item.name || "Product",
      productImage: product?.primaryImage || null,
      sku: variant?.sku || null,
      size: variant?.size || null,
      color: variant?.color || null,
      fabric: variant?.fabric || null,
      quantity,
      unitPrice,
      mrp: product?.mrp ?? null,
      lineTotal: unitPrice * quantity,
    });
    if (!variant) logger.warn(`[Shiprocket order] ${cartId}: unknown variant ${item.variant_id} (${item.title})`);
  }

  // Money: total_price is the cart before discounts (observed: 3600 with 360 off).
  const subtotal = snapshots.reduce((sum, s) => sum + s.lineTotal, 0) || Number(p.total_price) || 0;
  const discountAmount = Number(p.total_discount) || 0;
  const shippingCharge = Number(p.shipping_price) || 0;
  const taxAmount = Number(p.tax) || 0;
  const total = Math.max(0, (Number(p.total_price) || subtotal) - discountAmount + shippingCharge);

  // Customer: the shop account with the same phone number, if any.
  const shippingAddress = toShippingAddress(p.shipping_address || p.billing_address);
  const phone = shippingAddress.phone || digits(p.billing_address?.phone);
  const user = phone ? await User.findOne({ phone, isDeleted: false }).lean() : null;

  const rawPayment = String(p.payment_type || p.payment_method || p.gateway || "").toLowerCase();
  // Shiprocket writes COD as "CASH_ON_DELIVERY"; anything else it names is a prepaid method.
  const paymentMethod = rawPayment && !/cod|cash/.test(rawPayment) ? "online" : "cod";

  const orderNumber = await nextOrderNumber();
  const placedAt = p.created_at ? new Date(p.created_at) : new Date();
  const itemDocs = await OrderItem.insertMany(snapshots.map((s) => ({ ...s, orderId: null })));
  const order = await Order.create({
    orderNumber,
    userId: user?._id ?? null,
    guestEmail: null,
    items: itemDocs.map((d) => d._id),
    shippingAddress,
    discountAmount,
    shippingCharge,
    taxAmount,
    subtotal,
    total,
    paymentMethod,
    shiprocketOrderId: cartId,
    source: "shiprocket",
    status: "Created",
    statusHistory: [
      {
        status: "Created",
        timestamp: placedAt,
        actorId: null,
        actorEmail: null,
        note: `Placed through Shiprocket Checkout (cart ${cartId})${rawPayment ? "" : ", payment recorded as COD"}`,
      },
    ],
  });
  await OrderItem.updateMany({ _id: { $in: itemDocs.map((d) => d._id) } }, { $set: { orderId: order._id } });

  // Stock: reserve it exactly like the shop's own checkout does, so cancel (releases), paid and
  // delivered (confirm) behave the same for both kinds of order. Then tell Shiprocket the new levels.
  for (const s of snapshots) {
    if (!s.variantId) continue;
    try {
      await variantService.reserveStock(s.variantId, s.quantity);
    } catch (err) {
      // The sale already happened in Shiprocket; record the order anyway and flag the stock.
      logger.warn(`[Shiprocket order] ${orderNumber}: could not reserve ${s.quantity} of ${s.sku || s.variantId} (${err.message})`);
    }
    queueShiprocketSync(s.productId);
  }

  try {
    await AdminNotification.create({
      title: "New Order Placed",
      message: `Order #${orderNumber} has been placed through Shiprocket Checkout.`,
      type: "order_placed",
      relatedId: order._id,
    });
  } catch (err) {
    logger.error(`[Shiprocket order] Admin notification failed for ${orderNumber}: ${err.message}`);
  }

  // The customer's saved cart: take out what they just ordered (covers closing the checkout
  // window before the success page, or ordering from another device).
  if (user) {
    try {
      await cartService.removeOrderedItems(user._id, snapshots.map((s) => ({ variantId: s.variantId, quantity: s.quantity })));
    } catch (err) {
      logger.warn(`[Shiprocket order] ${orderNumber}: could not tidy the customer's cart (${err.message})`);
    }
  }

  await ShiprocketOrder.updateOne({ _id: delivery._id }, { $set: { processed: true, shopOrderId: order._id } });
  logger.info(`[Shiprocket order] ${cartId} → ${orderNumber} (${snapshots.length} items, ₹${total}, ${user ? "customer " + user._id : "guest"})`);

  // Into the shipping panel once due (immediately while SHIPROCKET_SHIP_DELAY_MINUTES is 0).
  createDueShipments().catch((err) => logger.error(`[Shiprocket shipping] ${err.message}`));
  return order;
}

/** Import every stored order delivery not yet turned into a shop order. Returns counts. */
export async function importPendingShiprocketOrders() {
  const pending = await ShiprocketOrder.find({ kind: "order", processed: false }).lean();
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const delivery of pending) {
    try {
      (await importShiprocketOrder(delivery)) ? created++ : skipped++;
    } catch (err) {
      failed++;
      logger.error(`[Shiprocket order] Import of delivery ${delivery._id} failed: ${err.message}`);
    }
  }
  return { pending: pending.length, created, skipped, failed };
}
