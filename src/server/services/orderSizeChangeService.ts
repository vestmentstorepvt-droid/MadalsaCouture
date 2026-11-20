// @ts-nocheck — same loose typing as the ported services it works with.
import { AdminNotification, Order, OrderItem, Variant } from "@/server/models/registry";
import logger from "@/server/config/logger";
import { CUSTOMER_CANCELLABLE_STATUSES } from "@/shared/cancelReasons";

/**
 * "Want a different size" instead of cancelling: the customer picks another size for items in an
 * order that hasn't left yet. The request goes to Admin straight away (notification + order history);
 * the order itself is unchanged until the team swaps the piece.
 */

const NOTE_MAX = 300;
const err = (message, statusCode, code) => Object.assign(new Error(message), { statusCode, code });

const available = (v) => Math.max(0, (Number(v.stock) || 0) - (Number(v.reservedStock) || 0));

/** The order, if it belongs to this customer and hasn't been handed to the courier. */
async function changeableOrder(orderId, userId) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw err("Order not found.", 404, "ORDER_NOT_FOUND");
  if (!order.userId || String(order.userId) !== String(userId)) throw err("You do not have access to this order.", 403, "FORBIDDEN");
  if (order.shiprocketShipping?.awb || !CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
    throw err("This order is already with the courier, so the size can't be changed here.", 409, "ORDER_NOT_CHANGEABLE");
  }
  return order;
}

/** For each item: the other sizes of the same piece (same colour), and whether they're in stock. */
export async function getSizeOptions(orderId, userId) {
  const order = await changeableOrder(orderId, userId);
  const items = await OrderItem.find({ _id: { $in: order.items || [] } }).lean();
  const result = [];
  for (const item of items) {
    if (!item.productId) continue;
    const variants = await Variant.find({ productId: item.productId, isDeleted: false }).lean();
    const options = variants
      .filter((v) => v.size && (!item.color || !v.color || v.color === item.color))
      .map((v) => ({ variantId: String(v._id), size: v.size, available: available(v) > 0, current: String(v._id) === String(item.variantId) }));
    // One entry per size (the same size can exist twice when colour is missing on one variant).
    const bySize = new Map();
    for (const o of options) if (!bySize.has(o.size) || o.current || (o.available && !bySize.get(o.size).available)) bySize.set(o.size, o);
    result.push({
      itemId: String(item._id),
      productTitle: item.productTitle,
      productImage: item.productImage || null,
      color: item.color || null,
      currentSize: item.size || null,
      quantity: item.quantity,
      options: [...bySize.values()],
    });
  }
  return { items: result, pending: order.sizeChangeRequest?.status === "pending" ? order.sizeChangeRequest : null };
}

/** Body: { changes: [{ itemId, variantId }], note? }. Records the request and tells Admin. */
export async function requestSizeChange(orderId, userId, { changes, note } = {}) {
  const order = await changeableOrder(orderId, userId);
  if (!Array.isArray(changes) || changes.length === 0) throw err("Choose the new size.", 400, "SIZE_REQUIRED");

  const items = await OrderItem.find({ _id: { $in: order.items || [] } }).lean();
  const lines = [];
  for (const c of changes) {
    const item = items.find((i) => String(i._id) === String(c?.itemId));
    if (!item) throw err("That item isn't in this order.", 400, "ITEM_NOT_FOUND");
    const variant = await Variant.findOne({ _id: c.variantId, isDeleted: false }).lean();
    if (!variant || String(variant.productId) !== String(item.productId)) throw err("That size isn't available for this piece.", 400, "SIZE_NOT_FOUND");
    if (String(variant._id) === String(item.variantId)) continue;
    if (available(variant) < (item.quantity || 1)) throw err(`Size ${variant.size} of ${item.productTitle} is out of stock.`, 409, "SIZE_OUT_OF_STOCK");
    lines.push({ itemId: String(item._id), productTitle: item.productTitle, fromSize: item.size || null, toSize: variant.size, variantId: String(variant._id), quantity: item.quantity });
  }
  if (lines.length === 0) throw err("Choose a size different from the one you ordered.", 400, "SIZE_UNCHANGED");

  const cleanNote = typeof note === "string" ? note.trim().slice(0, NOTE_MAX) : "";
  const summary = lines.map((l) => `${l.productTitle}: ${l.fromSize || "?"} → ${l.toSize}`).join("; ");
  const request = { status: "pending", at: new Date(), changes: lines, note: cleanNote || null };

  const updated = await Order.findOneAndUpdate(
    { _id: order._id },
    {
      $set: { sizeChangeRequest: request },
      $push: {
        statusHistory: {
          status: order.status,
          timestamp: new Date(),
          actorId: userId,
          actorEmail: null,
          note: `Size change requested by customer: ${summary}${cleanNote ? ` (${cleanNote})` : ""}`,
        },
      },
    },
    { new: true },
  ).lean();

  try {
    await AdminNotification.create({
      title: "Size change requested",
      message: `Order #${order.orderNumber}: ${summary}${cleanNote ? `. Note: ${cleanNote}` : ""}`,
      type: "size_change_requested",
      relatedId: order._id,
    });
  } catch (e) {
    logger.error(`Admin notification for size change on ${order.orderNumber} failed: ${e.message}`);
  }
  logger.info(`Size change requested on ${order.orderNumber} by ${userId}: ${summary}`);
  return updated;
}
