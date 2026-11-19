import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { CheckCircle, Home } from 'lucide-react';
import type { RootState } from '../../store';
import { removeFromCart, selectCartItems, updateQuantity } from '../../store/slices/cartSlice';
import { takeCheckoutItems } from '../../services/shiprocketCheckoutAlternative';
import { useRemoveOrderedItemsApiMutation } from '../../services/cartApi';

const sameLine = (a: { productId: string; variantId?: string; size?: string; color?: string }, b: typeof a) =>
  a.productId === b.productId &&
  (a.variantId ?? '') === (b.variantId ?? '') &&
  (a.size ?? '') === (b.size ?? '') &&
  (a.color ?? '') === (b.color ?? '');

/**
 * Checkout Success Page
 * Displayed after successful Shiprocket payment
 */
const CheckoutSuccess: React.FC = () => {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [removeOrderedItemsApi] = useRemoveOrderedItemsApiMutation();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('oid');

  useEffect(() => {
    // Take out only what was ordered (remembered when checkout opened); anything added since stays.
    const ordered = takeCheckoutItems();
    if (ordered.length) {
      const bag = selectCartItems(store.getState());
      for (const item of ordered) {
        const line = bag.find((b) => sameLine(b, item));
        if (!line) continue;
        if (line.quantity > item.quantity) {
          dispatch(updateQuantity({ ...item, quantity: line.quantity - item.quantity }));
        } else {
          dispatch(removeFromCart(item));
        }
      }
      // The saved cart on the server too, or the cart page would bring them back.
      const withSizes = ordered.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId as string, quantity: i.quantity }));
      if (isAuthenticated && withSizes.length) {
        removeOrderedItemsApi({ items: withSizes }).catch(() => { /* the order webhook tidies it too */ });
      }
    }

    // Track conversion with Meta Pixel once per order, so a page refresh does not double-count it
    try {
      const trackedKey = `purchase_tracked_${orderId || 'session'}`;
      if (!sessionStorage.getItem(trackedKey)) {
        sessionStorage.setItem(trackedKey, '1');
        window.fbq?.('track', 'Purchase', {
          currency: 'INR',
          value: 0, // Shiprocket provides actual value
          content_type: 'product'
        });
      }
    } catch { /* silent */ }
  }, [dispatch, orderId]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-20 w-20 text-emerald-600" />
        </div>

        <h1 className="font-serif text-3xl uppercase tracking-wide text-slate-900 mb-3">
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
            className="block w-full bg-[#3D2C24] text-white py-3 px-4 text-center font-serif font-semibold uppercase tracking-wide hover:bg-[#2D1C14] transition rounded"
          >
            View My Orders
          </Link>

          <Link
            to="/products"
            className="flex items-center justify-center gap-2 w-full border border-[#3D2C24] text-[#3D2C24] py-3 px-4 text-center font-serif font-semibold uppercase tracking-wide hover:bg-[#3D2C24] hover:text-white transition rounded"
          >
            <Home className="h-4 w-4" /> Continue Shopping
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          Questions? <a href="mailto:support@madalsa.com" className="text-[#E85D88] hover:underline">Contact our support team</a>
        </p>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
