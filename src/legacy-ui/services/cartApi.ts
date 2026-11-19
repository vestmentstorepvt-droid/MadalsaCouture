import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface BackendCartItem {
  _id: string;
  productId: {
    _id: string;
    title?: string;
    name?: string;
    slug?: string;
    images?: Array<string | { url?: string; role?: string }>;
    basePrice?: number;
    mrp?: number;
  };
  variantId?: {
    _id: string;
    size?: string;
    color?: string;
    sku?: string;
    price?: number;
    mrp?: number;
    stockQuantity?: number;
  } | null;
  name: string;
  image: string;
  size?: string;
  color?: string;
  price: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface BackendCart {
  _id: string;
  user: string;
  items: BackendCartItem[];
  subtotal: number;
  totalItems: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AddToCartPayload {
  productId: string;
  variantId?: string;
  quantity?: number;
  selectedSize?: string;
  selectedColor?: string;
}

export interface UpdateCartItemPayload {
  itemId: string;
  quantity: number;
}

export interface SyncCartPayload {
  items: Array<{
    productId: string;
    variantId?: string;
    selectedSize?: string;
    selectedColor?: string;
    size?: string;
    color?: string;
    quantity: number;
    price?: number;
  }>;
}

function extractCart(response: unknown): BackendCart | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;

  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    const inner = r.data as Record<string, unknown>;
    if (inner.cart && typeof inner.cart === 'object') {
      return inner.cart as BackendCart;
    }
  }

  if (r.cart && typeof r.cart === 'object') {
    return r.cart as BackendCart;
  }

  return response as BackendCart;
}

export const cartApi = createApi({
  reducerPath: 'cartApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Cart'],
  endpoints: (builder) => ({
    // GET /api/v1/cart
    getCart: builder.query<BackendCart | null, void>({
      query: () => ENDPOINTS.CART.BASE,
      transformResponse: (response: unknown) => extractCart(response),
      providesTags: ['Cart'],
    }),

    // POST /api/v1/cart/items
    addToCartApi: builder.mutation<BackendCart | null, AddToCartPayload>({
      query: (body) => ({
        url: ENDPOINTS.CART.ITEMS,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => extractCart(response),
      invalidatesTags: ['Cart'],
    }),

    // PATCH /api/v1/cart/items/:itemId
    updateCartItemApi: builder.mutation<BackendCart | null, UpdateCartItemPayload>({
      query: ({ itemId, quantity }) => ({
        url: ENDPOINTS.CART.ITEM_DETAIL(itemId),
        method: 'PATCH',
        body: { quantity },
      }),
      transformResponse: (response: unknown) => extractCart(response),
      invalidatesTags: ['Cart'],
    }),

    // DELETE /api/v1/cart/items/:itemId
    removeCartItemApi: builder.mutation<BackendCart | null, string>({
      query: (itemId) => ({
        url: ENDPOINTS.CART.ITEM_DETAIL(itemId),
        method: 'DELETE',
      }),
      transformResponse: (response: unknown) => extractCart(response),
      invalidatesTags: ['Cart'],
    }),

    // DELETE /api/v1/cart
    clearCartApi: builder.mutation<BackendCart | null, void>({
      query: () => ({
        url: ENDPOINTS.CART.BASE,
        method: 'DELETE',
      }),
      transformResponse: (response: unknown) => extractCart(response),
      invalidatesTags: ['Cart'],
    }),

    // POST /api/v1/cart/sync
    syncCartApi: builder.mutation<BackendCart | null, SyncCartPayload>({
      query: (body) => ({
        url: ENDPOINTS.CART.SYNC,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => extractCart(response),
      invalidatesTags: ['Cart'],
    }),

    // POST /api/v1/cart/remove-ordered — take just-ordered sizes out of the saved cart
    removeOrderedItemsApi: builder.mutation<BackendCart | null, { items: { variantId: string; quantity: number }[] }>({
      query: (body) => ({
        url: ENDPOINTS.CART.REMOVE_ORDERED,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => extractCart(response),
      invalidatesTags: ['Cart'],
    }),
  }),
});

export const {
  useGetCartQuery,
  useAddToCartApiMutation,
  useUpdateCartItemApiMutation,
  useRemoveCartItemApiMutation,
  useClearCartApiMutation,
  useSyncCartApiMutation,
  useRemoveOrderedItemsApiMutation,
} = cartApi;
