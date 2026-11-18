import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

// ── Exact shape returned by GET /api/v1/wishlist ──────────────────────────────
// Backend wishlistService.getWishlist returns per item:
//   { _id, title, slug, basePrice, primaryImage }
// Wrapped in: { data: { wishlist: [...] } }
export interface WishlistItem {
  _id: string;
  title: string;
  slug: string;
  basePrice: number;
  primaryImage: string | null;
}

// ── POST /api/v1/wishlist/:productId  →  { data: { wishlist: ObjectId[] } }
// ── DELETE /api/v1/wishlist/:productId → { data: { wishlist: ObjectId[] } }
// These mutations return the updated raw wishlist array (not populated).
// We only care about cache invalidation — no meaningful shape needed.

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export const wishlistApi = createApi({
  reducerPath: 'wishlistApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Wishlist'],
  endpoints: (builder) => ({

    // GET /api/v1/wishlist
    // Response envelope: { success: true, data: { wishlist: WishlistItem[] } }
    getWishlist: builder.query<WishlistItem[], void>({
      query: () => ENDPOINTS.WISHLIST,
      transformResponse: (response: unknown): WishlistItem[] => {
        const r = response as Record<string, unknown>;

        // Shape: { data: { wishlist: [...] } }
        if (r?.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
          const inner = r.data as Record<string, unknown>;
          if (Array.isArray(inner.wishlist)) return inner.wishlist as WishlistItem[];
          if (Array.isArray(inner.items)) return inner.items as WishlistItem[];
        }

        // Shape: { data: [...] }
        if (Array.isArray(r?.data)) return r.data as WishlistItem[];

        // Shape: flat array
        if (Array.isArray(response)) return response as WishlistItem[];

        return [];
      },
      providesTags: ['Wishlist'],
    }),

    // POST /api/v1/wishlist/:productId
    // Body: none (productId is a URL param)
    // Response: { success: true, data: { wishlist: ObjectId[] } }
    addToWishlist: builder.mutation<{ wishlist: string[] }, string>({
      query: (productId) => ({
        url: ENDPOINTS.WISHLIST_ITEM(productId),
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<{ wishlist: string[] }>) =>
        response.data,
      invalidatesTags: ['Wishlist'],
    }),

    // DELETE /api/v1/wishlist/:productId
    // Body: none (productId is a URL param)
    // Response: { success: true, data: { wishlist: ObjectId[] } }
    removeFromWishlist: builder.mutation<{ wishlist: string[] }, string>({
      query: (productId) => ({
        url: ENDPOINTS.WISHLIST_ITEM(productId),
        method: 'DELETE',
      }),
      transformResponse: (response: ApiResponse<{ wishlist: string[] }>) =>
        response.data,
      invalidatesTags: ['Wishlist'],
    }),
  }),
});

export const {
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
} = wishlistApi;
