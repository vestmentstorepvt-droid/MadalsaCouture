import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { RootState } from '../store';
import { removeFromCart, selectCartItems, updateQuantity } from '../store/slices/cartSlice';
import { useRemoveOrderedItemsApiMutation } from '../services/cartApi';
import {
  isCheckoutOrdered,
  peekPendingCheckout,
  takeCheckoutItems,
  trackCheckoutPurchase,
  type CheckedOutItem,
} from '../services/shiprocketCheckoutAlternative';

const sameLine = (a: { productId: string; variantId?: string; size?: string; color?: string }, b: typeof a) =>
  a.productId === b.productId &&
  (a.variantId ?? '') === (b.variantId ?? '') &&
  (a.size ?? '') === (b.size ?? '') &&
  (a.color ?? '') === (b.color ?? '');

/** Takes the ordered items out of the bag (local and the saved server cart); anything added since stays. */
export function useRemoveCheckedOutItems() {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [removeOrderedItemsApi] = useRemoveOrderedItemsApiMutation();

  return useCallback(
    (ordered: CheckedOutItem[]) => {
      if (!ordered.length) return;
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
      const withSizes = ordered
        .filter((i) => i.variantId)
        .map((i) => ({ variantId: i.variantId as string, quantity: i.quantity }));
      if (isAuthenticated && withSizes.length) {
        removeOrderedItemsApi({ items: withSizes }).catch(() => {
          /* the order webhook tidies the saved cart too */
        });
      }
    },
    [dispatch, store, isAuthenticated, removeOrderedItemsApi],
  );
}

const POLL_MS = 8000;
const WATCH_FOR_MS = 2 * 60 * 60 * 1000;

/**
 * Covers shoppers who never reach /checkout-success (closed the Shiprocket window after paying,
 * or the redirect failed): while a checkout is open, ask the server whether Shiprocket has
 * reported the order, and empty those items from the bag once it has.
 * Mounted once in the storefront header.
 */
export function useCheckoutCleanupWatcher() {
  const removeItems = useRemoveCheckedOutItems();
  const busy = useRef(false);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;

    const check = async () => {
      if (busy.current || stopped) return;
      const pending = peekPendingCheckout();
      if (!pending?.sessionId || Date.now() - pending.at > WATCH_FOR_MS) return;
      busy.current = true;
      try {
        if (await isCheckoutOrdered(pending.sessionId)) {
          trackCheckoutPurchase(); // shopper closed the window instead of reaching /checkout-success
          removeItems(takeCheckoutItems());
        }
      } finally {
        busy.current = false;
      }
    };

    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') await check();
        schedule();
      }, POLL_MS);
    };

    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    void check();
    schedule();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [removeItems]);
}
