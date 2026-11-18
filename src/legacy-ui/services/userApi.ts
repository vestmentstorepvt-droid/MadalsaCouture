import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface UserAddress {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  addressLine?: string | null;
  pincode?: string | null;
}

export interface CustomerUser {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: 'active' | 'blocked';
  role?: string;
  authProvider?: string;
  address?: UserAddress | null;
  addresses?: Array<{
    _id?: string;
    fullName?: string;
    phone?: string;
    addressLine?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    isDefault?: boolean;
  }> | string[];
  wishlist?: string[];
  isEmailVerified?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface UserQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UsersResponse {
  users: CustomerUser[];
  pagination: PaginationMeta;
}

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Users'],
  endpoints: (builder) => ({
    getUsers: builder.query<UsersResponse, UserQueryParams>({
      query: (params = {}) => ({
        url: ENDPOINTS.ADMIN.USERS,
        params: {
          ...(params.page !== undefined && { page: params.page }),
          ...(params.limit !== undefined && { limit: params.limit }),
          ...(params.status && params.status !== 'ALL' && { status: params.status }),
          ...(params.search?.trim() && { search: params.search.trim() }),
        },
      }),
      transformResponse: (response: unknown): UsersResponse => {
        const fallbackPagination: PaginationMeta = { total: 0, page: 1, limit: 10, totalPages: 1 };

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { users: [...] }, meta: { pagination: {...} } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.users)) {
              const meta = r.meta as { pagination?: PaginationMeta } | undefined;
              return {
                users: inner.users as CustomerUser[],
                pagination: meta?.pagination ?? fallbackPagination,
              };
            }
          }

          // Shape: { data: [...], pagination: {...} }  (direct array in data)
          if (Array.isArray(r.data) && r.pagination) {
            return { users: r.data as CustomerUser[], pagination: r.pagination as PaginationMeta };
          }

          // Shape: { users: [...], pagination: {...} }  (no envelope)
          if (Array.isArray(r.users)) {
            return {
              users: r.users as CustomerUser[],
              pagination: (r.pagination as PaginationMeta) ?? fallbackPagination,
            };
          }

          // Shape: raw array
          if (Array.isArray(response)) {
            return { users: response as CustomerUser[], pagination: fallbackPagination };
          }
        }

        return { users: [], pagination: fallbackPagination };
      },
      providesTags: ['Users'],
    }),

    getUserById: builder.query<CustomerUser, string>({
      query: (id) => ({
        url: ENDPOINTS.ADMIN.USER_DETAIL(id),
      }),
      transformResponse: (response: unknown): CustomerUser => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.user && typeof inner.user === 'object') {
              return inner.user as CustomerUser;
            }
          }
          if (r.user && typeof r.user === 'object') {
            return r.user as CustomerUser;
          }
        }
        return response as CustomerUser;
      },
      providesTags: (_result, _error, id) => [{ type: 'Users', id }],
    }),

    updateUserStatus: builder.mutation<void, { id: string; status: 'active' | 'blocked' }>({
      query: ({ id, status }) => ({
        url: ENDPOINTS.ADMIN.USER_STATUS(id),
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (_result, _error, { id }) => ['Users', { type: 'Users', id }],
    }),
  }),
});

export const { useGetUsersQuery, useGetUserByIdQuery, useUpdateUserStatusMutation } = userApi;
