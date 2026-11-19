// @ts-nocheck — Express-style router like the other ported routes.
import crypto from "node:crypto";
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/config/logger";
import { ShiprocketOrder } from "@/server/models/registry";

const express = __imp0;
const logger = __imp1;

/**
 * Webhooks from Shiprocket, mounted at /api/v1/webhooks/store:
 *
 *   POST /tracking  Shipping panel (Settings → API → Webhooks): shipment / courier status updates.
 *   POST /order     Shiprocket Checkout: completed orders.
 *
 * Shiprocket refuses webhook URLs containing "shiprocket", "sr" or "kr", hence the neutral path.
 * Neither payload's format is published, so for now every delivery is saved exactly as received
 * in `shiprocketorders` (with `kind`); turning them into the shop's Orders / shipment statuses
 * comes once real deliveries show the fields.
 *
 * Security: the request must carry the shared secret SHIPROCKET_ORDER_WEBHOOK_SECRET, in the
 * `x-api-key` header (what the shipping panel's "Auth Token Type: x-api-key" sends) or in
 * `X-Webhook-Secret` (a custom header). Anything else is refused. Repeat deliveries of the same
 * body are stored once.
 */
const router = express.Router();

const sameSecret = (given, expected) => {
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const receive = (kind) => async (req, res) => {
  const expected = (process.env.SHIPROCKET_ORDER_WEBHOOK_SECRET || "").trim();
  if (!expected) {
    logger.error(`[Shiprocket ${kind} webhook] SHIPROCKET_ORDER_WEBHOOK_SECRET is not set; delivery refused`);
    return res.status(503).json({ ok: false, error: "Webhook not configured" });
  }
  const given = req.headers["x-api-key"] || req.headers["x-webhook-secret"];
  if (!sameSecret(given, expected)) {
    logger.warn(`[Shiprocket ${kind} webhook] Refused a delivery with a missing or wrong secret`);
    return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
  }

  const raw = req.rawBody || JSON.stringify(req.body || {});
  // Same body delivered again (Shiprocket retries) → same id → stored once.
  const eventId = crypto.createHash("sha256").update(`${kind}:${raw}`).digest("hex").slice(0, 24);
  try {
    const existing = await ShiprocketOrder.findById(eventId).lean();
    if (!existing) {
      const payload = req.body && typeof req.body === "object" ? req.body : { raw };
      await ShiprocketOrder.create({
        _id: eventId,
        kind,
        payload,
        // Best guesses for a quick look; the full payload is kept either way.
        orderId: payload.order_id ?? payload.orderId ?? payload.id ?? null,
        awb: payload.awb ?? payload.awb_code ?? null,
        status: payload.current_status ?? payload.shipment_status ?? payload.status ?? payload.order_status ?? null,
        processed: false,
      });
      logger.info(`[Shiprocket ${kind} webhook] Stored delivery ${eventId} (order ${payload.order_id ?? payload.id ?? "?"})`);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error(`[Shiprocket ${kind} webhook] Could not store delivery: ${err.message}`);
    // 500 so Shiprocket retries later instead of the update being lost.
    return res.status(500).json({ ok: false });
  }
};

router.post("/tracking", receive("tracking"));
router.post("/order", receive("order"));
// Shiprocket checks the URL is reachable when the webhook is saved; answer plainly, reveal nothing.
const reachable = (req, res) => res.status(200).json({ ok: true });
router.get("/tracking", reachable);
router.get("/order", reachable);

const __exports: any = router;
export default __exports;
