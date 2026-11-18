import { createApi } from '@reduxjs/toolkit/query/react';
import { ENDPOINTS } from '../constants/endpoints';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import type { ApiErrorResponse, RegisterRequest, RegisterResponse } from '../types/auth';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponseData {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  role?: string;
  user?: {
    id?: string;
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface RefreshTokenRequest {
  refreshToken?: string;
}

export interface RefreshTokenResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user?: {
    id?: string;
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Auth'],
  endpoints: (builder) => ({
    // POST /api/v1/auth/register
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({
        url: ENDPOINTS.AUTH.REGISTER,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    // POST /api/v1/auth/login
    login: builder.mutation<LoginResponseData, LoginRequest>({
      query: (body) => ({
        url: ENDPOINTS.AUTH.LOGIN,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown): LoginResponseData => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            return r.data as LoginResponseData;
          }
        }
        return response as LoginResponseData;
      },
      invalidatesTags: ['Auth'],
    }),

    // POST /api/v1/auth/google
    googleLogin: builder.mutation<LoginResponseData & { message?: string }, { token?: string; idToken?: string; credential?: string; mode?: 'login' | 'signup' }>({
      query: (body) => ({
        url: ENDPOINTS.AUTH.GOOGLE,
        method: 'POST',
        body,
      }),

      transformResponse: (response: unknown): LoginResponseData => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            return r.data as LoginResponseData;
          }
        }
        return response as LoginResponseData;
      },
      invalidatesTags: ['Auth'],
    }),

    // POST /api/v1/auth/forgot-password

    forgotPassword: builder.mutation<{ message?: string }, ForgotPasswordRequest>({
      query: (body) => ({
        url: '/auth/forgot-password',
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

    // POST /api/v1/auth/reset-password
    resetPassword: builder.mutation<{ message?: string }, ResetPasswordRequest>({
      query: (body) => ({
        url: '/auth/reset-password',
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

    // POST /api/v1/auth/refresh-token
    refreshToken: builder.mutation<RefreshTokenResponseData, RefreshTokenRequest | void>({
      query: (body) => ({
        url: '/auth/refresh-token',
        method: 'POST',
        body: body || {},
      }),
      transformResponse: (response: unknown): RefreshTokenResponseData => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            return r.data as RefreshTokenResponseData;
          }
        }
        return response as RefreshTokenResponseData;
      },
    }),

    // POST /api/v1/auth/verify-email-change
    verifyEmailChange: builder.mutation<{ message?: string }, { token: string }>({
      query: (body) => ({
        url: '/auth/verify-email-change',
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') return r.data as { message?: string };
          if (typeof r.message === 'string') return { message: r.message };
        }
        return {};
      },
      invalidatesTags: ['Auth'],
    }),

    // POST /api/v1/auth/logout
    logout: builder.mutation<void, { refreshToken?: string } | void>({
      query: (body) => ({
        url: '/auth/logout',
        method: 'POST',
        body: body || {},
      }),
      invalidatesTags: ['Auth'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useGoogleLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useRefreshTokenMutation,
  useVerifyEmailChangeMutation,
  useLogoutMutation,
} = authApi;


export type { ApiErrorResponse, RegisterRequest, RegisterResponse };
