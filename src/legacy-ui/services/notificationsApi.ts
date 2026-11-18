import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export interface NotificationTemplate {
  _id?: string;
  type: string;
  subject: string;
  htmlBody: string;
  body?: string; // backward-compat alias
  requiredPlaceholders?: string[];
  variables?: string[]; // backward-compat alias
  isActive: boolean;
  updatedBy?: string | { _id: string; name?: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationLog {
  _id: string;
  type: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: string | null;
  error?: string | null;
  userId?: string | { _id: string; name?: string; email?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLogsParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  recipient?: string;
  userId?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedLogsResponse {
  logs: NotificationLog[];
  pagination: PaginationMeta;
}

function normalizeTemplate(t: any): NotificationTemplate {
  if (!t) return t;
  return {
    ...t,
    subject: t.subject || '',
    htmlBody: t.htmlBody || t.body || '',
    body: t.htmlBody || t.body || '',
    requiredPlaceholders: t.requiredPlaceholders || t.variables || [],
    variables: t.requiredPlaceholders || t.variables || [],
    isActive: t.isActive !== undefined ? t.isActive : true,
  };
}

export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['NotificationTemplates', 'NotificationLogs'],
  endpoints: (builder) => ({
    getTemplates: builder.query<NotificationTemplate[], void>({
      query: () => ENDPOINTS.ADMIN.NOTIFICATIONS_TEMPLATES,
      transformResponse: (response: unknown): NotificationTemplate[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { templates: [...] } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.templates)) return inner.templates.map(normalizeTemplate);
            if (Array.isArray(inner.data)) return inner.data.map(normalizeTemplate);
          }

          // Shape: { data: [...] }
          if (Array.isArray(r.data)) return r.data.map(normalizeTemplate);
          if (Array.isArray(r.templates)) return r.templates.map(normalizeTemplate);
        }

        if (Array.isArray(response)) return response.map(normalizeTemplate);
        return [];
      },
      providesTags: ['NotificationTemplates'],
    }),

    getLogs: builder.query<PaginatedLogsResponse, NotificationLogsParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.NOTIFICATIONS_LOGS,
        params: params
          ? {
              ...(params.page !== undefined && { page: params.page }),
              ...(params.limit !== undefined && { limit: params.limit }),
              ...(params.type && params.type !== 'All' && params.type !== 'ALL' && { type: params.type }),
              ...(params.status && params.status !== 'all' && params.status !== 'ALL' && { status: params.status }),
              ...(params.recipient && { recipient: params.recipient.trim() }),
              ...(params.userId && { userId: params.userId }),
            }
          : undefined,
      }),
      transformResponse: (response: unknown): PaginatedLogsResponse => {
        const fallback: PaginationMeta = { total: 0, page: 1, limit: 20, totalPages: 1 };

        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { logs: [...] }, meta: { total, page, limit, totalPages } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.logs)) {
              const meta = (r.meta as { pagination?: PaginationMeta; total?: number; page?: number; limit?: number; totalPages?: number } | undefined);
              const pagination = meta?.pagination ?? (meta?.total !== undefined ? { total: meta.total, page: meta.page || 1, limit: meta.limit || 20, totalPages: meta.totalPages || 1 } : fallback);
              return { logs: inner.logs as NotificationLog[], pagination };
            }
          }

          // Shape: { data: [...], pagination: {...} }
          if (Array.isArray(r.data)) {
            return {
              logs: r.data as NotificationLog[],
              pagination: (r.pagination as PaginationMeta) ?? fallback,
            };
          }

          // Shape: { logs: [...] }
          if (Array.isArray(r.logs)) {
            return { logs: r.logs as NotificationLog[], pagination: fallback };
          }
        }

        return { logs: [], pagination: fallback };
      },
      providesTags: ['NotificationLogs'],
    }),

    updateTemplate: builder.mutation<
      NotificationTemplate,
      {
        type: string;
        data: {
          subject?: string;
          htmlBody?: string;
          body?: string;
          requiredPlaceholders?: string[];
          variables?: string[];
          isActive?: boolean;
        };
      }
    >({
      query: ({ type, data }) => ({
        url: ENDPOINTS.ADMIN.NOTIFICATION_TEMPLATE(type),
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: unknown): NotificationTemplate => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).template) {
            return normalizeTemplate((r.data as Record<string, unknown>).template);
          }
          if (r.data) return normalizeTemplate(r.data);
        }
        return normalizeTemplate(response);
      },
      invalidatesTags: ['NotificationTemplates'],
    }),
  }),
});

export const {
  useGetTemplatesQuery,
  useGetLogsQuery,
  useUpdateTemplateMutation,
} = notificationsApi;

export default notificationsApi;
