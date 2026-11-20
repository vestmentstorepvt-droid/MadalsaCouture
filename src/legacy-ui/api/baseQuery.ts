import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store';
import { logout, updateToken } from '../store/slices/authSlice';
import { metaCookieHeaders } from '../utils/metaPixel';

const normalizeBaseUrl = (value?: string) => {
  const raw = (value || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  return raw.replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
const API_VERSION_PREFIX = '/api/v1';

const readAuthToken = (getState?: () => unknown) => {
  const state = getState?.() as RootState | undefined;
  const tokenFromState = state?.auth?.token ?? null;

  if (typeof window === 'undefined') {
    return tokenFromState;
  }

  return (
    tokenFromState ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token') ||
    null
  );
};

export const baseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE_URL}${API_VERSION_PREFIX}`,
  prepareHeaders: (headers, { getState, arg, type }) => {
    const token = readAuthToken(getState);

    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }

    // Actions the server reports to Meta (add to bag, sign up, order) carry the pixel cookies.
    if (type === 'mutation') {
      for (const [name, value] of Object.entries(metaCookieHeaders())) headers.set(name, value);
    }

    // Only set content-type if not already set (lets multipart/form-data keep its boundary)
    const isFormData =
      typeof FormData !== 'undefined' &&
      typeof arg === 'object' && arg !== null &&
      (arg as FetchArgs).body instanceof FormData;
    if (!headers.has('content-type') && !isFormData) {
      headers.set('content-type', 'application/json');
    }

    return headers;
  },
});

type RefreshApi = Parameters<typeof baseQuery>[1];
type RefreshExtra = Parameters<typeof baseQuery>[2];

// One in-flight refresh shared by every request that hits a 401 at the same time.
let refreshPromise: Promise<boolean> | null = null;

const refreshAccessToken = async (api: RefreshApi, extraOptions: RefreshExtra): Promise<boolean> => {
  const state = api.getState() as RootState;
  const refreshToken = state.auth.refreshToken || localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  const refreshResult = await baseQuery(
    { url: '/auth/refresh-token', method: 'POST', body: { refreshToken } },
    api,
    extraOptions
  );

  const responseData = refreshResult.data as { data?: { accessToken?: string; refreshToken?: string } } | undefined;
  const newAccessToken = responseData?.data?.accessToken;
  if (!newAccessToken) return false;

  api.dispatch(updateToken({ token: newAccessToken, refreshToken: responseData?.data?.refreshToken }));
  return true;
};

const forceLogout = (api: RefreshApi) => {
  api.dispatch(logout());
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('mock_user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
};

export const baseQueryWithErrorLogging: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401 && readAuthToken(api.getState)) {
    refreshPromise ??= refreshAccessToken(api, extraOptions)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });

    const refreshed = await refreshPromise;

    if (refreshed) {
      result = await baseQuery(args, api, extraOptions);
    } else {
      forceLogout(api);
    }
  }

  if (result.error) {
    const status = result.error.status;
    const url = typeof args === 'string' ? args : args.url;

    // Skip logging 404 for certain endpoints where it's expected (e.g., inactive announcement bar)
    const isSuppressed404 = status === 404 && url?.includes('/cms/announcement-bar');

    // Don't log if it was a 401 that we successfully recovered from (since result.error would be cleared after retry if success)
    if (!isSuppressed404) {
      console.error(`[API Error] ${status ?? 'UNKNOWN'} ${url}`, result.error.data ?? result.error);
    }
  }

  return result;
};
