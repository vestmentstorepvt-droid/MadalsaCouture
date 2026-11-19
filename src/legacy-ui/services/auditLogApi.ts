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

/**
 * The server stores audit entries as { module, actorEmail/actorId, timestamp }; the admin pages
 * read { entity, performedBy, createdAt }. Map one onto the other (keeping any value already there).
 */
export function normalizeAuditLog(raw: unknown): AuditLog {
  const l = (raw ?? {}) as Record<string, unknown>;
  return {
    ...(l as unknown as AuditLog),
    entity: (l.entity as string) ?? (l.module && l.module !== 'unknown' ? (l.module as string) : '—'),
    performedBy: (l.performedBy as AuditLog['performedBy']) ?? ((l.actorEmail as string) || (l.actorId as string) || '—'),
    createdAt: (l.createdAt as string) ?? (l.timestamp as string),
  };
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
              return { data: inner.logs.map(normalizeAuditLog), pagination: meta?.pagination ?? fallback };
            }
          }

          // Shape: { data: [...], pagination: {...} }
          if (Array.isArray(r.data)) {
            return { data: r.data.map(normalizeAuditLog), pagination: (r.pagination as typeof fallback) ?? fallback };
          }
        }

        return { data: [], pagination: fallback };
      },
      providesTags: ['AuditLogs'],
    }),
  }),
});

export const { useGetAuditLogsQuery } = auditLogApi;
