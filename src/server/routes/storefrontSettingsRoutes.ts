import { Router } from "@/server/http/router";
import type { Req, Res } from "@/server/http/types";

// GET /api/v1/storefront-settings: the offers the storefront advertises in the bag.
// The amounts themselves are applied by Shiprocket Checkout (its dashboard has the same rules);
// these environment variables keep what the site says in step with it.
//   FREE_SHIPPING_THRESHOLD_INR  free shipping at or above this subtotal (default 5000)
//   PREPAID_DISCOUNT_PERCENT     extra % off when paying online instead of COD (default 5; 0 hides it)

const num = (value: string | undefined, fallback: number) => {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const router = new Router();

router.get("/", (_req: Req, res: Res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({
    success: true,
    data: {
      freeShippingThreshold: num(process.env.FREE_SHIPPING_THRESHOLD_INR, 5000),
      prepaidDiscountPercent: num(process.env.PREPAID_DISCOUNT_PERCENT, 5),
    },
  });
});

export default router;
