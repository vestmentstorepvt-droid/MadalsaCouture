import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface AdminExchange {
  _id: string;
  orderId: any;
  requestedBy: any;
  orderItemId: any;
  reason: string;
  customerNote?: string;
  requestedVariantId?: any;
  status: 'ExchangeRequested' | 'ExchangeApproved' | 'ExchangeRejected' | 'ExchangePickupScheduled' | 'ExchangeInTransit' | 'QCPassed' | 'QCFailed' | 'ReplacementShipped' | 'ExchangeCompleted';
  adminDecision?: { note?: string | null };
  qcResult?: { passed?: boolean; note?: string | null };
  createdAt: string;
  updatedAt: string;
}

export const adminExchangesApi = createApi({
  reducerPath: 'adminExchangesApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['AdminExchanges'],
  endpoints: (builder) => ({
    getAdminExchanges: builder.query<{ exchanges: AdminExchange[] }, { orderId?: string }>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.EXCHANGES,
        params,
      }),
      transformResponse: (response: { data: { exchanges: AdminExchange[] } }) => response.data,
      providesTags: ['AdminExchanges'],
    }),

    getExchangeById: builder.query<{ exchange: AdminExchange }, string>({
      query: (id) => `${ENDPOINTS.ADMIN.EXCHANGES}/${id}`,
      transformResponse: (response: { data: { exchange: AdminExchange } }) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'AdminExchanges', id }],
    }),

    approveExchange: builder.mutation<{ exchange: AdminExchange }, { id: string; note?: string }>({
      query: ({ id, note }) => ({
        url: `${ENDPOINTS.ADMIN.EXCHANGES}/${id}/approve`,
        method: 'PATCH',
        body: { note },
      }),
      transformResponse: (response: { data: { exchange: AdminExchange } }) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminExchanges', id }, 'AdminExchanges'],
    }),

    rejectExchange: builder.mutation<{ exchange: AdminExchange }, { id: string; note: string }>({
      query: ({ id, note }) => ({
        url: `${ENDPOINTS.ADMIN.EXCHANGES}/${id}/reject`,
        method: 'PATCH',
        body: { note },
      }),
      transformResponse: (response: { data: { exchange: AdminExchange } }) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminExchanges', id }, 'AdminExchanges'],
    }),

    qcExchange: builder.mutation<{ exchange: AdminExchange }, { id: string; passed: boolean; note?: string }>({
      query: ({ id, passed, note }) => ({
        url: `${ENDPOINTS.ADMIN.EXCHANGES}/${id}/qc`,
        method: 'PATCH',
        body: { passed, note },
      }),
      transformResponse: (response: { data: { exchange: AdminExchange } }) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminExchanges', id }, 'AdminExchanges'],
    }),
  }),
});

export const {
  useGetAdminExchangesQuery,
  useGetExchangeByIdQuery,
  useApproveExchangeMutation,
  useRejectExchangeMutation,
  useQcExchangeMutation,
} = adminExchangesApi;
