import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ShieldCheck, Truck, CreditCard, ArrowLeft, AlertCircle } from 'lucide-react';

import { selectCartItems, selectCartSubtotal } from '../../store/slices/cartSlice';
import { optimizeImage } from '../../utils/imageUtils';
import { generateCheckoutToken, openShiprocketCheckout, rememberCheckoutItems } from '../../services/shiprocketCheckoutAlternative';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * Checkout page — Order review and payment.
 *
 * Displays the order summary and proceeds with the payment flow.
 */
const Checkout: React.FC = () => {
  const cartItems = useSelector(selectCartItems);
  const cartSubtotal = useSelector(selectCartSubtotal);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Meta Pixel: InitiateCheckout — fires once when the page loads with items.
  useEffect(() => {
    if (cartItems.length === 0 || !cartSubtotal) return;
    try {
      window.fbq?.('track', 'InitiateCheckout', {
        value: cartSubtotal,
        currency: 'INR',
        num_items: cartItems.length,
        content_ids: cartItems.map((item) => item.productId),
        content_type: 'product',
      }, { eventID: `ic_${Date.now()}` });
    } catch { /* silent */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckoutClick = async () => {
    try {
      // Prevent multiple simultaneous requests
      if (isProcessing) return;

      // Validate cart
      if (cartItems.length === 0) {
        setError('Your cart is empty');
        return;
      }

      const itemWithoutVariant = cartItems.find((item) => !item.variantId);
      if (itemWithoutVariant) {
        setError(`Please remove "${itemWithoutVariant.name}" from your cart and add it again with a size selected.`);
        return;
      }

      const cartForBackend = cartItems.map((item) => ({
        variantId: item.variantId as string,
        quantity: item.quantity
      }));

      setIsProcessing(true);
      setError(null);

      const token = await generateCheckoutToken(cartForBackend);
      // Remembered so the success page takes exactly these out of the bag.
      rememberCheckoutItems(
        cartItems.map(({ productId, variantId, size, color, quantity }) => ({ productId, variantId, size, color, quantity }))
      );
      await openShiprocketCheckout(token);
      // Checkout now sits over this page; if the shopper closes it, the button works again.
      setIsProcessing(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Checkout failed. Please try again.';
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-center px-4">
        <div className="space-y-4">
          <p className="font-serif text-xl text-slate-800 uppercase tracking-widest">Your cart is empty</p>
          <Link
            to="/products"
            className="inline-block border border-[#3D2C24] px-6 py-3 text-xs uppercase tracking-widest text-[#3D2C24] hover:bg-[#3D2C24] hover:text-white transition-all"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-10 space-y-2 pt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Secure Checkout</p>
          <h1 className="font-serif text-3xl uppercase tracking-wide text-slate-900">Checkout</h1>
          <div className="mx-auto h-0.5 w-12 bg-[#D4AF37]" />
        </div>

        <div className="rounded-2xl border border-[#E2D9CC] bg-white p-6 space-y-5 shadow-sm">
          <h2 className="font-serif text-lg uppercase tracking-wider text-slate-900">Order Summary</h2>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {cartItems.map((item) => (
              <div key={`${item.productId}-${item.variantId ?? ''}`} className="flex items-center gap-3">
                <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-stone-200">
                  {item.image && (
                    <img src={optimizeImage(item.image, 400)} alt={item.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                  {(item.size || item.color) && (
                    <p className="text-[11px] text-slate-500">{[item.size, item.color].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="text-[11px] text-stone-500">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-slate-800 shrink-0">
                  {formatINR(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E2D9CC] pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatINR(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span>Shipping, coupons &amp; taxes</span>
              <span>Calculated in next step</span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Checkout Error</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <button
            disabled={isProcessing}
            className="w-full bg-[#3D2C24] text-white py-3 px-4 text-center font-serif font-semibold uppercase tracking-wide hover:bg-[#2D1C14] transition rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCheckoutClick}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              'Proceed to Secure Checkout'
            )}
          </button>

          <ul className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-500 text-center">
            <li className="flex flex-col items-center gap-1">
              <Truck className="h-4 w-4 text-[#D4AF37]" /> Fast Shipping
            </li>
            <li className="flex flex-col items-center gap-1">
              <CreditCard className="h-4 w-4 text-[#D4AF37]" /> Secure Payment
            </li>
            <li className="flex flex-col items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-[#D4AF37]" /> Protected Checkout
            </li>
          </ul>
        </div>

        <Link
          to="/cart"
          className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-[#3D2C24] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Cart
        </Link>
      </div>
    </div>
  );
};

export default Checkout;
