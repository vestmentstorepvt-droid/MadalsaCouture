import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CheckCircle, Home } from 'lucide-react';
import { clearCart } from '../../store/slices/cartSlice';

/**
 * Checkout Success Page
 * Displayed after successful Shiprocket payment
 */
const CheckoutSuccess: React.FC = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('oid');

  useEffect(() => {
    dispatch(clearCart());

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
