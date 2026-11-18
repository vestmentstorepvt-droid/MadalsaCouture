import { createSlice } from '@reduxjs/toolkit';
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

const initialState: CartState = { items: storedItems };

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
      try {
        localStorage.removeItem('cart');
      } catch {
        // Storage access may fail in certain environments — silent fail
      }
    },
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart, setCart } = cartSlice.actions;


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
