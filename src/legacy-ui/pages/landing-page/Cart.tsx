import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import {
  ShoppingBag, Plus, Minus, Trash2, ArrowRight,
  Tag, RefreshCw, Heart, ChevronRight
} from 'lucide-react';
import { optimizeImage } from '../../utils/imageUtils';
import {
  selectCartItems,
  selectCartSubtotal,
  selectCartItemCount,
  updateQuantity,
  removeFromCart,
  clearCart,
  setCart,
  type CartItem,
} from '../../store/slices/cartSlice';
import {
  useGetCartQuery,
  useUpdateCartItemApiMutation,
  useRemoveCartItemApiMutation,
  useClearCartApiMutation,
} from '../../services/cartApi';
import type { AppDispatch } from '../../store';

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

// ── Cart Item Row ──────────────────────────────────────────────────────────────
const CartItemRow: React.FC<{
  item: CartItem;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
}> = ({ item, onUpdateQty, onRemove }) => (
  <div className="flex items-start gap-4 sm:gap-5 rounded-2xl border border-[#E2D9CC] bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
    {/* Image */}
    <div className="h-24 w-20 sm:h-28 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
      {item.image ? (
        <img src={optimizeImage(item.image, 200)} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full flex items-center justify-center">
          <ShoppingBag className="h-7 w-7 text-slate-300" />
        </div>
      )}
    </div>

    {/* Details */}
    <div className="flex flex-1 flex-col gap-2.5 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-slate-900 leading-snug line-clamp-2">
            {item.name}
          </h3>
          {(item.size || item.color) && (
            <p className="text-xs text-slate-500 mt-0.5">
              size - {[item.size, item.color].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Qty + price row */}
      <div className="flex items-center justify-between gap-2">
        {/* Stepper */}
        <div className="flex items-center border border-[#E2D9CC] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => onUpdateQty(item.quantity - 1)}
            className="px-3 py-2 text-slate-600 hover:bg-[#FAF7F2] transition"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="px-4 py-2 text-sm font-bold text-slate-800 border-x border-[#E2D9CC] min-w-[2.5rem] text-center bg-white">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQty(item.quantity + 1)}
            className="px-3 py-2 text-slate-600 hover:bg-[#FAF7F2] transition"
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Line total */}
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{formatINR(item.price * item.quantity)}</p>
          {item.quantity > 1 && (
            <p className="text-[11px] text-slate-400">{formatINR(item.price)} each</p>
          )}
        </div>
      </div>
    </div>
  </div>
);

// ── Empty Cart ─────────────────────────────────────────────────────────────────
const EmptyCart: React.FC = () => (
  <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center gap-6 text-center px-4">
    <div className="w-24 h-24 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
      <ShoppingBag className="h-12 w-12 text-[#D4AF37]" />
    </div>
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Shopping Bag</p>
      <h2 className="font-serif text-2xl uppercase tracking-widest text-slate-800">Your bag is empty</h2>
      <p className="text-sm text-slate-500 max-w-sm">
        Discover our luxury collections and add your favourite pieces.
      </p>
    </div>
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        to="/products"
        className="inline-flex items-center gap-2 border border-[#3D2C24] bg-[#3D2C24] px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FFF8ED] hover:bg-transparent hover:text-[#3D2C24] transition-all"
      >
        Explore Collections <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        to="/wishlist"
        className="inline-flex items-center gap-2 border border-[#D4AF37] text-[#3D2C24] px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-[#D4AF37]/10 transition-all"
      >
        <Heart className="h-4 w-4" /> View Wishlist
      </Link>
    </div>
  </div>
);

// ── Main Cart Page ─────────────────────────────────────────────────────────────
const Cart: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector(selectCartItems);
  const subtotal = useSelector(selectCartSubtotal);
  const itemCount = useSelector(selectCartItemCount);

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { data: backendCart } = useGetCartQuery(undefined, { skip: !isAuthenticated });

  const [updateCartItemApi] = useUpdateCartItemApiMutation();
  const [removeCartItemApi] = useRemoveCartItemApiMutation();
  const [clearCartApi] = useClearCartApiMutation();

  useEffect(() => {
    // Never replace a populated local bag with an empty server cart (e.g. before a guest bag is synced)
    if (backendCart && Array.isArray(backendCart.items) && backendCart.items.length > 0) {
      const formattedItems: CartItem[] = backendCart.items.map((item) => ({
        productId: typeof item.productId === 'object' ? item.productId._id : item.productId,
        cartItemId: item._id,
        variantId: item.variantId ? item.variantId._id : undefined,
        name: item.name || (typeof item.productId === 'object' ? item.productId.title || item.productId.name || '' : ''),
        image: item.image || '',
        price: item.price || item.unitPrice || 0,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
      }));
      dispatch(setCart(formattedItems));
    }
  }, [backendCart, dispatch]);

  const handleUpdateQty = async (item: CartItem, newQty: number) => {
    dispatch(updateQuantity({
      productId: item.productId,
      variantId: item.variantId,
      size: item.size,
      color: item.color,
      quantity: newQty,
    }));
    if (!isAuthenticated || !item.cartItemId) return;
    try {
      await updateCartItemApi({ itemId: item.cartItemId, quantity: newQty }).unwrap();
    } catch {
      // Offline fallback: the local bag stays as the source of truth
    }
  };

  const handleRemove = async (item: CartItem) => {
    dispatch(removeFromCart({
      productId: item.productId,
      variantId: item.variantId,
      size: item.size,
      color: item.color,
    }));
    if (!isAuthenticated || !item.cartItemId) return;
    try {
      await removeCartItemApi(item.cartItemId).unwrap();
    } catch {
      // Offline fallback: the local bag stays as the source of truth
    }
  };

  const handleClear = async () => {
    dispatch(clearCart());
    if (!isAuthenticated) return;
    try {
      await clearCartApi().unwrap();
    } catch {
      // Offline fallback: the local bag stays as the source of truth
    }
  };

  if (items.length === 0) return <EmptyCart />;

  const shippingThreshold = 1499;
  const freeShipping = subtotal >= shippingThreshold;
  const remaining = shippingThreshold - subtotal;

  return (
    <div className="min-h-screen bg-[#FAF7F2] pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Shopping Bag</p>
          <h1 className="font-serif text-3xl uppercase tracking-wide text-slate-900">
            Your Bag <span className="text-[#D4AF37]">({itemCount})</span>
          </h1>
          <div className="mx-auto h-0.5 w-12 bg-[#D4AF37]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ── Items ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Link to="/" className="hover:text-[#D4AF37] transition">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="font-semibold text-slate-800">Shopping Bag</span>
            </div>

            {items.map((item: CartItem) => (
              <CartItemRow
                key={`${item.productId}-${item.variantId ?? ''}-${item.size ?? ''}-${item.color ?? ''}`}
                item={item}
                onUpdateQty={(qty) => handleUpdateQty(item, qty)}
                onRemove={() => handleRemove(item)}
              />
            ))}

            {/* Clear cart */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-500 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Clear bag
              </button>
            </div>
          </div>


          {/* ── Summary ───────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[#E2D9CC] bg-white p-6 space-y-5 shadow-sm sticky top-24">
            <h2 className="font-serif text-lg uppercase tracking-wide text-slate-900 border-b border-[#E2D9CC] pb-3">
              Order Summary
            </h2>

            {/* Free shipping progress */}
            {!freeShipping && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500">
                  Add <strong className="text-[#3D2C24]">{formatINR(remaining)}</strong> more for free shipping
                </p>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#D4AF37] transition-all duration-500"
                    style={{ width: `${Math.min((subtotal / shippingThreshold) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {freeShipping && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <Tag className="w-3.5 h-3.5" /> You qualify for free shipping!
              </div>
            )}

            {/* Line items */}
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                <span className="font-semibold text-slate-900">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                {freeShipping
                  ? <span className="text-emerald-600 font-semibold">FREE</span>
                  : <span className="text-slate-400">Calculated at checkout</span>
                }
              </div>
            </div>

            {/* Total */}
            <div className="border-t border-[#E2D9CC] pt-4 flex justify-between">
              <span className="font-serif text-base font-semibold uppercase tracking-wide text-slate-900">Total</span>
              <span className="font-serif text-lg font-bold text-[#3D2C24]">{formatINR(subtotal)}</span>
            </div>

            {/* CTA — Proceed to Checkout */}
            <Link
              to="/checkout"
              className="block w-full bg-[#3D2C24] text-white py-3 px-4 text-center font-serif font-semibold uppercase tracking-wide hover:bg-[#2D1C14] transition rounded"
            >
              Checkout
            </Link>

            <Link
              to="/products"
              className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-[#3D2C24] transition"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
