import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { optimizeImage } from '../../../utils/imageUtils';
import {
  selectCartItems,
  selectCartSubtotal,
  selectCartItemCount,
  updateQuantity,
  removeFromCart,
  type CartItem,
} from '../../../store/slices/cartSlice';
import type { AppDispatch } from '../../../store';

interface CartSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const CartSideDrawer: React.FC<CartSideDrawerProps> = ({ isOpen, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector(selectCartItems);
  const subtotal = useSelector(selectCartSubtotal);
  const itemCount = useSelector(selectCartItemCount);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleUpdateQty = (item: CartItem, newQty: number) => {
    if (newQty < 1) {
      dispatch(removeFromCart({
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        color: item.color,
      }));
    } else {
      dispatch(updateQuantity({
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        color: item.color,
        quantity: newQty,
      }));
    }
  };

  const handleRemove = (item: CartItem) => {
    dispatch(removeFromCart({
      productId: item.productId,
      variantId: item.variantId,
      size: item.size,
      color: item.color,
    }));
  };

  const shippingThreshold = 1499;
  const freeShipping = subtotal >= shippingThreshold;
  const remaining = shippingThreshold - subtotal;
  const shippingProgress = Math.min((subtotal / shippingThreshold) * 100, 100);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-[95] h-full w-full max-w-[420px] bg-canvas shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-400 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ transitionDuration: '350ms' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4 shrink-0 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink">
              <ShoppingBag className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">
                Your Bag
              </h2>
              <p className="text-xs text-stone-500 tracking-wider">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 hover:text-ink hover:border-ink transition-all"
            aria-label="Close cart drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Free shipping progress ── */}
        {items.length > 0 && (
          <div className="px-5 border-b shrink-0 bg-white/40 h-11 rounded-full border border-hairline-strong bg-surface text-ink text-sm font-medium transition-colors hover:bg-hairline-soft">
            {freeShipping ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 rounded-xl px-3 py-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                You qualify for free shipping!
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-stone-500 tracking-wide">
                  Add <strong className="text-ink font-semibold">{formatINR(remaining)}</strong> more for free shipping
                </p>
                <div className="h-1.5 rounded-full bg-stone-200/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-ink transition-all duration-700 ease-out"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Items list ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#D5CDBE transparent' }}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
              <div className="w-20 h-20 rounded-full bg-ink/10 flex items-center justify-center">
                <ShoppingBag className="h-9 w-9 text-accent" />
              </div>
              <div className="space-y-1">
                <p className="text-base text-stone-700 font-semibold">Your bag is empty</p>
                <p className="text-xs text-stone-400">Discover our luxury collections</p>
              </div>
              <Link
                to="/products"
                onClick={onClose}
                className="inline-flex items-center gap-2 bg-ink px-6 text-xs tracking-[0.18em] text-white h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover"
              >
                Explore Collections <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.productId}-${item.variantId ?? ''}-${item.size ?? ''}-${item.color ?? ''}`}
                className="flex gap-3.5 rounded-xl border border-hairline bg-white p-3 shadow-sm hover:shadow-md transition-shadow group"
              >
                {/* Image */}
                <div className="h-[88px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  {item.image ? (
                    <img
                      src={optimizeImage(item.image, 150)}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-stone-300" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-between min-w-0 py-0.5">
                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="text-[13px] font-semibold text-stone-800 leading-snug line-clamp-1">
                        {item.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleRemove(item)}
                        className="shrink-0 p-1 rounded-md text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition opacity-0 group-hover:opacity-100"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {(item.size || item.color) && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        {[item.size && `Size: ${item.size}`, item.color].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Qty stepper + price */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item, item.quantity - 1)}
                        className="px-2 py-1 text-stone-500 hover:bg-stone-100 transition"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2.5 py-1 text-[12px] font-bold text-stone-800 border-x border-stone-200 min-w-[28px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item, item.quantity + 1)}
                        className="px-2 py-1 text-stone-500 hover:bg-stone-100 transition"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-[13px] font-bold text-stone-800">
                      {formatINR(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Footer with totals + CTA ── */}
        {items.length > 0 && (
          <div className="shrink-0 border-t border-hairline bg-white px-5 py-4 space-y-3 shadow-md">
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-600">Subtotal</span>
              <span className="font-serif text-lg font-bold text-ink">{formatINR(subtotal)}</span>
            </div>

            <p className="text-xs text-stone-400 tracking-wide">Shipping & taxes calculated at checkout</p>

            {/* Checkout CTA */}
            <Link
              to="/checkout"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full bg-ink text-[12px] text-white h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover"
            >
              Checkout <ArrowRight className="h-4 w-4" />
            </Link>

            {/* View bag link */}
            <Link
              to="/cart"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-ink font-medium tracking-wider uppercase transition pt-1"
            >
              View Full Bag
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default CartSideDrawer;
