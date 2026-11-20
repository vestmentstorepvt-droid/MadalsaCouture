import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Home } from 'lucide-react';
import { takeCheckoutItems, trackCheckoutPurchase } from '../../services/shiprocketCheckoutAlternative';
import { useRemoveCheckedOutItems } from '../../hooks/useCheckoutCleanup';

/**
 * Checkout Success Page
 * Displayed after successful Shiprocket payment
 */
const CheckoutSuccess: React.FC = () => {
  const removeCheckedOutItems = useRemoveCheckedOutItems();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('oid');

  useEffect(() => {
    // Meta Pixel Purchase (bag value, paired with the server's event so the sale counts once).
    // Must run before takeCheckoutItems(), which clears the remembered checkout.
    trackCheckoutPurchase();
    // Take out only what was ordered (remembered when checkout opened); anything added since stays.
    removeCheckedOutItems(takeCheckoutItems());
  }, [removeCheckedOutItems]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-20 w-20 text-emerald-600" />
        </div>

        <h1 className="text-[32px] leading-10 tracking-[-1.28px] text-slate-900 mb-3 font-semibold">
          Order Confirmed!
        </h1>

        <p className="text-slate-600 mb-2">
          Thank you for your purchase. Your order has been successfully placed.
        </p>

        {orderId && (
          <p className="text-sm text-slate-500 mb-6 font-mono bg-slate-50 p-3 rounded-lg">
            Order ID: {orderId}
          </p>
        )}

        <p className="text-sm text-slate-500 mb-8">
          You'll receive a confirmation email shortly with tracking details and shipping information.
        </p>

        <div className="space-y-3">
          <Link
            to="/my-orders"
            className="w-full bg-ink text-white px-4 text-center transition h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover flex items-center justify-center"
          >
            View My Orders
          </Link>

          <Link
            to="/products"
            className="flex items-center justify-center gap-2 w-full border text-ink px-4 text-center transition h-11 rounded-full border-hairline-strong bg-surface text-sm font-medium transition-colors hover:bg-hairline-soft"
          >
            <Home className="h-4 w-4" /> Continue Shopping
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          Questions? <a href="mailto:support@madalsa.com" className="text-accent hover:underline">Contact our support team</a>
        </p>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
