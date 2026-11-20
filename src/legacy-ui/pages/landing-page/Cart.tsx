import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, Heart, Truck } from 'lucide-react';
import { optimizeImage } from '../../utils/imageUtils';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  selectCartItems,
  selectCartSubtotal,
  selectCartItemCount,
  updateQuantity,
  removeFromCart,
  clearCart,
  setCart,
  setLineSelected,
  setAllSelected,
  cartLineKey,
  selectCheckoutItems,
  selectCheckoutItemCount,
  selectCheckoutSubtotal,
  type CartItem,
} from '../../store/slices/cartSlice';
import {
  useGetCartQuery,
  useUpdateCartItemApiMutation,
  useRemoveCartItemApiMutation,
  useClearCartApiMutation,
} from '../../services/cartApi';
import type { AppDispatch } from '../../store';
import { useStorefrontOffers } from '../../hooks/useStorefrontOffers';

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

// ── Cart Item Row ──────────────────────────────────────────────────────────────
const CartItemRow: React.FC<{
  item: CartItem;
  selected: boolean;
  onToggle: (selected: boolean) => void;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
}> = ({ item, selected, onToggle, onUpdateQty, onRemove }) => (
  <li className="flex gap-3 py-6 sm:gap-5">
    {/* Tick: goes to checkout */}
    <label className="-ml-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center self-start rounded-full hover:bg-hairline-soft">
      <span className="sr-only">Include {item.name} in checkout</span>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-[18px] w-[18px] cursor-pointer rounded accent-[#171717]"
      />
    </label>

    {/* Image */}
    <div className={`aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-md bg-hairline-soft transition-opacity sm:w-28 ${selected ? '' : 'opacity-50'}`}>
      {item.image ? (
        <img src={optimizeImage(item.image, 300)} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <ShoppingBag className="h-6 w-6 text-faint" aria-hidden="true" />
        </div>
      )}
    </div>

    {/* Details */}
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-medium leading-snug text-ink">{item.name}</h3>
          {(item.size || item.color) && (
            <p className="mt-1 text-sm text-mute">
              {[item.size && `Size ${item.size}`, item.color].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <p className="shrink-0 text-base font-medium text-ink tabular-nums">{formatINR(item.price * item.quantity)}</p>
      </div>
      {item.quantity > 1 && (
        <p className="mt-0.5 text-right text-xs text-mute tabular-nums">{formatINR(item.price)} each</p>
      )}

      {/* Qty + remove */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="flex h-10 items-center rounded-full border border-hairline-strong bg-surface px-0.5">
          <button
            type="button"
            onClick={() => onUpdateQty(item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-hairline-soft disabled:text-faint disabled:hover:bg-transparent"
            aria-label={`Decrease quantity of ${item.name}`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-8 text-center text-sm font-medium text-ink tabular-nums" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQty(item.quantity + 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-hairline-soft"
            aria-label={`Increase quantity of ${item.name}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm text-mute transition-colors hover:text-ink"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </button>
      </div>
    </div>
  </li>
);

// ── Empty Cart ─────────────────────────────────────────────────────────────────
const EmptyCart: React.FC = () => (
  <div className="min-h-[70vh] bg-canvas px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:px-8">
    <div className="mx-auto max-w-2xl">
      <EmptyState
        icon={<ShoppingBag className="h-6 w-6" />}
        title="Your bag is empty"
        description="Discover our collections and add your favourite pieces."
        action={
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/products" className="btn-primary gap-2 px-6">
              Shop all products <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/wishlist" className="btn-secondary gap-2 px-6">
              <Heart className="h-4 w-4" aria-hidden="true" /> View wishlist
            </Link>
          </div>
        }
      />
    </div>
  </div>
);

// ── Main Cart Page ─────────────────────────────────────────────────────────────
const Cart: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector(selectCartItems);
  const itemCount = useSelector(selectCartItemCount);
  // The summary and checkout only count the ticked lines.
  const checkoutItems = useSelector(selectCheckoutItems);
  const subtotal = useSelector(selectCheckoutSubtotal);
  const offers = useStorefrontOffers();
  const selectedCount = useSelector(selectCheckoutItemCount);
  const selectedKeys = new Set(checkoutItems.map(cartLineKey));
  const allSelected = checkoutItems.length === items.length;
  const noneSelected = checkoutItems.length === 0;

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

  const shippingThreshold = offers.freeShippingThreshold;
  const freeShipping = subtotal >= shippingThreshold;
  const remaining = shippingThreshold - subtotal;

  return (
    <div className="min-h-screen bg-canvas pb-24 pt-6 lg:pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-mute">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to="/" className="hover:text-ink">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-ink" aria-current="page">Shopping bag</li>
          </ol>
        </nav>

        <SectionHeader
          as="h1"
          eyebrow="Shopping bag"
          title={<>Your bag <span className="text-mute tabular-nums">({itemCount})</span></>}
        />

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* ── Items ─────────────────────────────────────────────────── */}
          <section aria-label="Items in your bag" className="border-t border-hairline pt-2">
            {/* Select all */}
            <div className="flex items-center justify-between gap-3 pb-2">
              <label className="-ml-2 inline-flex cursor-pointer items-center gap-1 rounded-full pr-3 text-sm font-medium text-ink hover:bg-hairline-soft">
                <span className="flex h-10 w-10 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && !noneSelected; }}
                    onChange={(e) => dispatch(setAllSelected(e.target.checked))}
                    className="h-[18px] w-[18px] cursor-pointer rounded accent-[#171717]"
                  />
                </span>
                Select all
              </label>
              <p className="text-sm text-mute tabular-nums" aria-live="polite">
                {checkoutItems.length} of {items.length} selected
              </p>
            </div>

            <ul className="divide-y divide-hairline border-t border-hairline">
              {items.map((item: CartItem) => (
                <CartItemRow
                  key={cartLineKey(item)}
                  item={item}
                  selected={selectedKeys.has(cartLineKey(item))}
                  onToggle={(selected) => dispatch(setLineSelected({ item, selected }))}
                  onUpdateQty={(qty) => handleUpdateQty(item, qty)}
                  onRemove={() => handleRemove(item)}
                />
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-hairline pt-4">
              <Link to="/products" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                Continue shopping
              </Link>
              <button
                type="button"
                onClick={handleClear}
                className="h-10 px-2 text-sm text-mute underline underline-offset-4 hover:text-ink"
              >
                Clear bag
              </button>
            </div>
          </section>

          {/* ── Summary ───────────────────────────────────────────────── */}
          <aside aria-labelledby="order-summary-heading" className="rounded-2xl border border-hairline bg-surface p-6 lg:sticky lg:top-28">
            <h2 id="order-summary-heading" className="text-base font-semibold text-ink">Order summary</h2>

            {/* Free shipping progress */}
            {!noneSelected && <div className="mt-4">
              {freeShipping ? (
                <p className="flex items-center gap-2 text-sm text-body">
                  <Truck className="h-4 w-4 text-ink" aria-hidden="true" /> You qualify for free shipping
                </p>
              ) : (
                <>
                  <p className="text-sm text-body">
                    Add <strong className="font-medium text-ink tabular-nums">{formatINR(remaining)}</strong> more for free shipping
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-hairline-soft">
                    <div
                      className="h-full rounded-full bg-ink transition-[width] duration-500"
                      style={{ width: `${Math.min((subtotal / shippingThreshold) * 100, 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>}

            <dl className="mt-6 space-y-3 border-t border-hairline pt-6 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-body">Subtotal ({selectedCount} {selectedCount === 1 ? 'item' : 'items'})</dt>
                <dd className="text-ink tabular-nums">{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-body">Shipping</dt>
                <dd className={freeShipping ? 'text-ink' : 'text-mute'}>{freeShipping ? 'Free' : 'Calculated at checkout'}</dd>
              </div>
              {offers.prepaidDiscountPercent > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-body">Pay online</dt>
                  <dd className="text-right text-ink">Extra {offers.prepaidDiscountPercent}% off at checkout</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-hairline pt-4">
                <dt className="text-base font-semibold text-ink">Total</dt>
                <dd className="text-base font-semibold text-ink tabular-nums">{formatINR(subtotal)}</dd>
              </div>
            </dl>

            {noneSelected ? (
              <>
                <button type="button" disabled className="btn-primary mt-6 h-12 w-full">
                  Checkout
                </button>
                <p className="mt-3 text-center text-sm text-mute">Tick at least one item to check out.</p>
              </>
            ) : (
              <Link to="/checkout" className="btn-primary mt-6 h-12 w-full">
                {allSelected ? 'Checkout' : `Checkout ${checkoutItems.length} of ${items.length} items`}
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Cart;
