import { useEffect, useState } from 'react';

export interface StorefrontOffers {
  /** Free shipping at or above this bag subtotal (INR). */
  freeShippingThreshold: number;
  /** Extra % off for paying online instead of Cash on Delivery (0 = no offer). */
  prepaidDiscountPercent: number;
}

const DEFAULTS: StorefrontOffers = { freeShippingThreshold: 5000, prepaidDiscountPercent: 5 };
const API_BASE_URL = String(process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');

let cached: StorefrontOffers | null = null;
let pending: Promise<StorefrontOffers> | null = null;

function load(): Promise<StorefrontOffers> {
  pending ??= fetch(`${API_BASE_URL}/api/v1/storefront-settings`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const d = j?.data ?? {};
      cached = {
        freeShippingThreshold: Number.isFinite(d.freeShippingThreshold) ? d.freeShippingThreshold : DEFAULTS.freeShippingThreshold,
        prepaidDiscountPercent: Number.isFinite(d.prepaidDiscountPercent) ? d.prepaidDiscountPercent : DEFAULTS.prepaidDiscountPercent,
      };
      return cached;
    })
    .catch(() => {
      pending = null; // try again next time
      return DEFAULTS;
    });
  return pending;
}

/** Free-shipping threshold and online-payment discount, as configured on the server. */
export function useStorefrontOffers(): StorefrontOffers {
  const [offers, setOffers] = useState<StorefrontOffers>(cached ?? DEFAULTS);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    void load().then((o) => alive && setOffers(o));
    return () => {
      alive = false;
    };
  }, []);
  return offers;
}
