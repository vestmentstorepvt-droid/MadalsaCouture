import { createSelector, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface CartItem {
  productId: string;
  cartItemId?: string;
  variantId?: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
}

export interface CartState {
  items: CartItem[];
  /** Bag lines the shopper unticked; they stay in the bag but are not sent to checkout. */
  deselected: string[];
}

// Load persisted cart from localStorage on store initialisation
const storedItems = (() => {
  try {
    const raw = localStorage.getItem('cart');
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
})();

const storedDeselected = (() => {
  try {
    const raw = localStorage.getItem('cartDeselected');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed.filter((k) => typeof k === 'string') as string[]) : [];
  } catch {
    return [];
  }
})();

const initialState: CartState = { items: storedItems, deselected: storedDeselected };

type LineRef = { productId: string; variantId?: string; size?: string; color?: string };

/** Stable key for one bag line (product + variant + size + colour). */
export const cartLineKey = (item: LineRef): string =>
  [item.productId, item.variantId ?? '', item.size ?? '', item.color ?? ''].join('|');

/** Returns true when two cart entries refer to the same product+variant combination. */
function isSameItem(
  a: { productId: string; variantId?: string; size?: string; color?: string },
  b: { productId: string; variantId?: string; size?: string; color?: string }
): boolean {
  return a.productId === b.productId &&
    (a.variantId ?? '') === (b.variantId ?? '') &&
    (a.size ?? '') === (b.size ?? '') &&
    (a.color ?? '') === (b.color ?? '');
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /**
     * Add an item to the cart.
     * If the same productId + variantId already exists, increment its quantity.
     * Otherwise push the item as a new entry.
     */
    addToCart(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find((item) => isSameItem(item, action.payload));
      if (existing) {
        existing.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }
    },

    /**
     * Update the quantity of a specific cart item.
     * If the resulting quantity is less than 1, the item is removed entirely.
     */
    updateQuantity(
      state,
      action: PayloadAction<{ productId: string; variantId?: string; size?: string; color?: string; quantity: number }>
    ) {
      const { quantity } = action.payload;
      if (quantity < 1) {
        state.items = state.items.filter((item) => !isSameItem(item, action.payload));
      } else {
        const existing = state.items.find((item) => isSameItem(item, action.payload));
        if (existing) {
          existing.quantity = quantity;
        }
      }
    },

    /**
     * Remove a specific item from the cart by productId (and optionally variantId).
     */
    removeFromCart(
      state,
      action: PayloadAction<{ productId: string; variantId?: string; size?: string; color?: string }>
    ) {
      state.items = state.items.filter((item) => !isSameItem(item, action.payload));
    },

    /**
     * Replace cart items with new array (e.g. from backend API fetch or sync).
     */
    setCart(state, action: PayloadAction<CartItem[]>) {
      state.items = action.payload;
    },

    /**
     * Clear all items from the cart and remove the persisted localStorage entry.
     */
    clearCart(state) {
      state.items = [];
      state.deselected = [];
      try {
        localStorage.removeItem('cart');
      } catch {
        // Storage access may fail in certain environments — silent fail
      }
    },

    /** Tick or untick one bag line for checkout. */
    setLineSelected(state, action: PayloadAction<{ item: LineRef; selected: boolean }>) {
      const key = cartLineKey(action.payload.item);
      state.deselected = state.deselected.filter((k) => k !== key);
      if (!action.payload.selected) state.deselected.push(key);
    },

    /** Tick or untick every line in the bag. */
    setAllSelected(state, action: PayloadAction<boolean>) {
      state.deselected = action.payload ? [] : state.items.map(cartLineKey);
    },
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart, setCart, setLineSelected, setAllSelected } = cartSlice.actions;


export default cartSlice.reducer;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Returns the full list of cart items. */
export const selectCartItems = (state: RootState): CartItem[] => state.cart.items;

/** Returns the total number of units across all cart items (sum of quantities). */
export const selectCartItemCount = (state: RootState): number =>
  state.cart.items.reduce((total, item) => total + item.quantity, 0);

/** Returns the cart subtotal (sum of price × quantity for each item). */
export const selectCartSubtotal = (state: RootState): number =>
  state.cart.items.reduce((total, item) => total + item.price * item.quantity, 0);

/** True when this bag line is ticked for checkout (lines are ticked by default). */
export const selectIsLineSelected = (state: RootState, item: LineRef): boolean =>
  !state.cart.deselected.includes(cartLineKey(item));

/** The bag lines that go to checkout. */
export const selectCheckoutItems = createSelector(
  [(state: RootState) => state.cart.items, (state: RootState) => state.cart.deselected],
  (items, deselected): CartItem[] =>
    deselected.length === 0 ? items : items.filter((item) => !deselected.includes(cartLineKey(item))),
);

/** Units and subtotal of the ticked lines only. */
export const selectCheckoutItemCount = (state: RootState): number =>
  selectCheckoutItems(state).reduce((total, item) => total + item.quantity, 0);

export const selectCheckoutSubtotal = (state: RootState): number =>
  selectCheckoutItems(state).reduce((total, item) => total + item.price * item.quantity, 0);
