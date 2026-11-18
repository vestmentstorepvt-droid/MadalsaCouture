import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface AuditLog {
  _id: string;
  action: string;
  entity: string;
  entityId?: string;
  performedBy: { _id: string; name: string; email: string } | string;
  changes?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogsResponse {
  data: AuditLog[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}



export const auditLogApi = createApi({
  reducerPath: 'auditLogApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['AuditLogs'],
  endpoints: (builder) => ({
    getAuditLogs: builder.query<PaginatedAuditLogsResponse, AuditLogParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.AUDIT_LOGS,
        params: params ?? undefined,
      }),
      transformResponse: (response: unknown): PaginatedAuditLogsResponse => {
        const fallback = { total: 0, page: 1, limit: 20, totalPages: 0 };

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { logs: [...] }, meta: { pagination: {...} } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.logs)) {
              const meta = r.meta as { pagination?: typeof fallback } | undefined;
              return { data: inner.logs as AuditLog[], pagination: meta?.pagination ?? fallback };
            }
          }

          // Shape: { data: [...], pagination: {...} }
          if (Array.isArray(r.data)) {
            return { data: r.data as AuditLog[], pagination: (r.pagination as typeof fallback) ?? fallback };
          }
        }

        return { data: [], pagination: fallback };
      },
      providesTags: ['AuditLogs'],
    }),
  }),
});

export const { useGetAuditLogsQuery } = auditLogApi;
