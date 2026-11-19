import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';
import { normalizeAuditLog } from './auditLogApi';

export interface AuditLog {
  _id: string;
  action: string;
  entity: string;
  entityId?: string;
  performedBy: { _id: string; name: string; email: string } | string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogsParams {
  page?: number;
  limit?: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const recentActivityApi = createApi({
  reducerPath: 'recentActivityApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['AuditLogs'],
  endpoints: (builder) => ({
    getAuditLogs: builder.query<
      { logs: AuditLog[]; pagination?: PaginationMeta },
      AuditLogsParams
    >({
      query: (params = {}) => ({
        url: ENDPOINTS.ADMIN.AUDIT_LOGS,
        params: {
          ...(params.page !== undefined && { page: params.page }),
          ...(params.limit !== undefined && { limit: params.limit }),
        },
      }),
      transformResponse: (response: unknown): { logs: AuditLog[]; pagination?: PaginationMeta } => {
        const fallbackPagination: PaginationMeta = { total: 0, page: 1, limit: 8, totalPages: 1 };

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { logs: [...] }, meta: { pagination: {...} } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.logs)) {
              const meta = r.meta as { pagination?: PaginationMeta } | undefined;
              return {
                logs: inner.logs.map(normalizeAuditLog),
                pagination: meta?.pagination ?? fallbackPagination,
              };
            }
          }

          // Shape: { data: [...], pagination: {...} }
          if (Array.isArray(r.data) && r.pagination) {
            return { logs: r.data.map(normalizeAuditLog), pagination: r.pagination as PaginationMeta };
          }

          // Shape: { logs: [...], pagination: {...} }  (no envelope)
          if (Array.isArray(r.logs)) {
            return {
              logs: r.logs.map(normalizeAuditLog),
              pagination: (r.pagination as PaginationMeta) ?? fallbackPagination,
            };
          }

          // Shape: raw array
          if (Array.isArray(response)) {
            return { logs: response.map(normalizeAuditLog), pagination: fallbackPagination };
          }
        }

        return { logs: [], pagination: fallbackPagination };
      },
      providesTags: ['AuditLogs'],
    }),
  }),
});

export const { useGetAuditLogsQuery } = recentActivityApi;
