import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

// ── Data interfaces ───────────────────────────────────────────────────────────

export interface UserAddress {
  country?: string;
  state?: string;
  city?: string;
  addressLine?: string;
  pincode?: string;
}

export interface UserProfile {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  address?: UserAddress;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  address?: UserAddress;
}

export interface UpdateAdminProfilePayload {
  name?: string;
  email?: string;
  password?: string;
}

export interface ChangeEmailPayload {
  currentPassword: string;
  newEmail: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function extractUser(response: unknown): UserProfile {
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;

    // Shape: { success: true, data: { user: { ... } } }
    if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
      const inner = r.data as Record<string, unknown>;
      if (inner.user && typeof inner.user === 'object') {
        return inner.user as UserProfile;
      }
      return r.data as unknown as UserProfile;
    }

    // Shape: { user: { ... } }
    if (r.user && typeof r.user === 'object') {
      return r.user as UserProfile;
    }
  }
  return response as UserProfile;
}

// ── RTK Query slice ───────────────────────────────────────────────────────────

export const profileApi = createApi({
  reducerPath: 'profileApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Profile'],
  endpoints: (builder) => ({
    // GET /api/v1/auth/profile
    getProfile: builder.query<UserProfile, void>({
      query: () => ENDPOINTS.AUTH.PROFILE,
      transformResponse: extractUser,
      providesTags: ['Profile'],
    }),

    // PUT /api/v1/auth/profile
    updateProfile: builder.mutation<UserProfile, UpdateProfilePayload>({
      query: (body) => ({
        url: ENDPOINTS.AUTH.PROFILE,
        method: 'PUT',
        body,
      }),
      transformResponse: extractUser,
      invalidatesTags: ['Profile'],
    }),

    // POST /api/v1/auth/change-email
    changeEmail: builder.mutation<{ message?: string }, ChangeEmailPayload>({
      query: (body) => ({
        url: ENDPOINTS.AUTH.CHANGE_EMAIL,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data) return r.data as { message?: string };
        }
        return response as { message?: string };
      },
    }),

    // POST /api/v1/auth/change-password
    changePassword: builder.mutation<{ message?: string }, ChangePasswordPayload>({
      query: (body) => ({
        url: ENDPOINTS.AUTH.CHANGE_PASSWORD,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data) return r.data as { message?: string };
        }
        return response as { message?: string };
      },
    }),

    // PATCH /api/v1/auth/admin-profile
    updateAdminProfile: builder.mutation<UserProfile, UpdateAdminProfilePayload>({
      query: (body) => ({
        url: ENDPOINTS.AUTH.ADMIN_PROFILE,
        method: 'PATCH',
        body,
      }),
      transformResponse: extractUser,
      invalidatesTags: ['Profile'],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangeEmailMutation,
  useChangePasswordMutation,
  useUpdateAdminProfileMutation,
} = profileApi;
