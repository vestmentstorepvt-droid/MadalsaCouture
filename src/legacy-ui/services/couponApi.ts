import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface CouponScope {
  categoryIds?: string[];
  collectionIds?: string[];
  productIds?: string[];
}

export interface Coupon {
  _id: string;
  code: string;
  name?: string;
  type: 'percentage' | 'flat' | 'free_shipping';
  value?: number | null;
  minOrderValue?: number;
  scope?: CouponScope;
  startDate?: string | null;
  endDate?: string | null;
  usageLimitTotal?: number | null;
  usageLimitPerCustomer?: number | null;
  usageCount?: number;
  usedCount?: number; // legacy alias
  stackable?: boolean;
  isActive: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CouponQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
}

export interface CreateCouponPayload {
  code: string;
  name?: string;
  type: 'percentage' | 'flat' | 'free_shipping';
  value?: number;
  minOrderValue?: number;
  scope?: CouponScope;
  startDate?: string;
  endDate?: string;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  isActive?: boolean;
}

export type UpdateCouponPayload = Partial<
  Omit<CreateCouponPayload, 'startDate' | 'endDate' | 'usageLimitTotal' | 'usageLimitPerCustomer'>
> & {
  startDate?: string | null;
  endDate?: string | null;
  usageLimitTotal?: number | null;
  usageLimitPerCustomer?: number | null;
};

interface PaginatedResponseMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CouponsResponse {
  coupons: Coupon[];
  pagination: PaginatedResponseMeta;
}

export const couponApi = createApi({
  reducerPath: 'couponApi',
  baseQuery: baseQueryWithErrorLogging,
  keepUnusedDataFor: 300,
  tagTypes: ['Coupons'],

  endpoints: (builder) => ({
    getCoupons: builder.query<CouponsResponse, CouponQueryParams>({
      query: (params = {}) => ({
        url: ENDPOINTS.ADMIN.COUPONS,
        params: {
          ...(params.page !== undefined && { page: params.page }),
          ...(params.limit !== undefined && { limit: params.limit }),
          ...(params.search?.trim() && { search: params.search.trim() }),
          ...(params.type && params.type !== 'ALL' && { type: params.type }),
        },
      }),
      transformResponse: (response: unknown): CouponsResponse => {
        const fallback: PaginatedResponseMeta = { total: 0, page: 1, limit: 10, totalPages: 1 };

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { coupons: [...] }, meta: { total, page, limit, totalPages } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.coupons)) {
              const meta = (r.meta as PaginatedResponseMeta | undefined) ?? fallback;
              return { coupons: inner.coupons as Coupon[], pagination: meta };
            }
          }

          // Shape: { data: [...], pagination: {...} }
          if (Array.isArray(r.data) && r.pagination) {
            return { coupons: r.data as Coupon[], pagination: r.pagination as PaginatedResponseMeta };
          }

          // Shape: { coupons: [...] } (no envelope)
          if (Array.isArray(r.coupons)) {
            return {
              coupons: r.coupons as Coupon[],
              pagination: (r.pagination as PaginatedResponseMeta) ?? (r.meta as PaginatedResponseMeta) ?? fallback,
            };
          }
        }

        return { coupons: [], pagination: fallback };
      },
      providesTags: ['Coupons'],
    }),

    createCoupon: builder.mutation<Coupon, CreateCouponPayload>({
      query: (body) => ({
        url: ENDPOINTS.ADMIN.COUPONS,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown): Coupon => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.coupon && typeof inner.coupon === 'object') {
              return inner.coupon as Coupon;
            }
          }
          if (r.coupon && typeof r.coupon === 'object') {
            return r.coupon as Coupon;
          }
        }
        return response as Coupon;
      },
      invalidatesTags: ['Coupons'],
    }),

    updateCoupon: builder.mutation<Coupon, { id: string; data: UpdateCouponPayload }>({
      query: ({ id, data }) => ({
        url: ENDPOINTS.ADMIN.COUPON_DETAIL(id),
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: unknown): Coupon => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.coupon && typeof inner.coupon === 'object') {
              return inner.coupon as Coupon;
            }
          }
          if (r.coupon && typeof r.coupon === 'object') {
            return r.coupon as Coupon;
          }
        }
        return response as Coupon;
      },
      invalidatesTags: ['Coupons'],
    }),

    deleteCoupon: builder.mutation<void, string>({
      query: (id) => ({
        url: ENDPOINTS.ADMIN.COUPON_DETAIL(id),
        method: 'DELETE',
      }),
      invalidatesTags: ['Coupons'],
    }),

    getActiveCoupons: builder.query<Coupon[], void>({

      query: () => '/coupons/active',
      transformResponse: (response: unknown): Coupon[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.coupons)) return inner.coupons as Coupon[];
          }
          if (Array.isArray(r.coupons)) return r.coupons as Coupon[];
        }
        if (Array.isArray(response)) return response as Coupon[];
        return [];
      },
      providesTags: ['Coupons'],
    }),
  }),
});

export const {
  useGetCouponsQuery,
  useGetActiveCouponsQuery,
  useCreateCouponMutation,
  useUpdateCouponMutation,
  useDeleteCouponMutation,
} = couponApi;

