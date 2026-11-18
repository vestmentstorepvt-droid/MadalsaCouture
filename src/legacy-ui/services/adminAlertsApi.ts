import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';

export interface AdminAlert {
  _id: string;
  title: string;
  message: string;
  type: string;
  relatedId: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminAlertsResponse {
  notifications: AdminAlert[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const adminAlertsApi = createApi({
  reducerPath: 'adminAlertsApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['AdminAlerts'],
  endpoints: (builder) => ({
    getAdminAlerts: builder.query<AdminAlertsResponse, { page?: number; limit?: number }>({
      query: (params) => ({
        url: '/admin/alerts',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['AdminAlerts'],
    }),
    markAlertAsRead: builder.mutation<{ notification: AdminAlert }, string>({
      query: (id) => ({
        url: `/admin/alerts/${id}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: ['AdminAlerts'],
    }),
    markAllAlertsAsRead: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/admin/alerts/read-all',
        method: 'PATCH',
      }),
      invalidatesTags: ['AdminAlerts'],
    }),
  }),
});

export const {
  useGetAdminAlertsQuery,
  useMarkAlertAsReadMutation,
  useMarkAllAlertsAsReadMutation,
} = adminAlertsApi;
