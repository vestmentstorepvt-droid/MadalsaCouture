import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

// ─── Exact backend response shapes ───────────────────────────────────────────

/** Shape returned by GET /api/v1/admin/dashboard → data.kpis */
export interface DashboardKpis {
  todayRevenue: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  /** e.g. [{ status: 'Delivered', count: 120 }, ...] */
  orderStatusBreakdown: Array<{ status: string; count: number }>;
  /** e.g. [{ date: '2026-07-01', revenue: 12000, orders: 4 }, ...] */
  salesChart: Array<{ date: string; revenue: number; orders: number }>;
  lowStockCount: number;
  newCustomers: number;
  /** e.g. [{ name: 'Silk Sari', revenue: 45000 }, ...] */
  topProducts: Array<{ name: string; revenue: number }>;
}

/** Shape of each row returned by GET /api/v1/admin/reports/sales → data.report[] */
export interface SalesReportRow {
  period: string;      // e.g. '2026-07-01' (day), '2026-W27' (week), '2026-07' (month)
  revenue: number;
  orderCount: number;
  aov: number;         // average order value
}

export interface SalesReportParams {
  from: string;        // ISO date string — REQUIRED by backend
  to: string;          // ISO date string — REQUIRED by backend
  groupBy?: 'day' | 'week' | 'month';  // default: 'day'
}

/** Shape of each order returned by GET /api/v1/admin/orders → data.orders[] */
export interface RecentOrderPayload {
  _id: string;
  orderNumber: string;
  userId?: { name?: string; email?: string } | string | null;
  guestEmail?: string;
  items?: Array<unknown>;
  total: number;
  status: string;
  createdAt: string;
}

export const adminOrdersApi = createApi({
  reducerPath: 'adminOrdersApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['AdminOrders', 'DashboardKpis'],
  endpoints: (builder) => ({

    // ── GET /api/v1/admin/dashboard ─────────────────────────────────────────
    // Response envelope: { data: { kpis: { ... } } }
    getDashboardKpis: builder.query<DashboardKpis, void>({
      query: () => ENDPOINTS.ADMIN.DASHBOARD,
      transformResponse: (response: unknown): DashboardKpis => {
        const defaults: DashboardKpis = {
          todayRevenue: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalCustomers: 0,
          totalProducts: 0,
          orderStatusBreakdown: [],
          salesChart: [],
          lowStockCount: 0,
          newCustomers: 0,
          topProducts: [],
        };
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          // Envelope: { data: { kpis: {...} } }
          const data = r.data as Record<string, unknown> | undefined;
          if (data?.kpis && typeof data.kpis === 'object') {
            return { ...defaults, ...(data.kpis as Partial<DashboardKpis>) };
          }
          // Fallback: { data: {...} } (flat)
          if (data && typeof data === 'object') {
            return { ...defaults, ...(data as Partial<DashboardKpis>) };
          }
        }
        return defaults;
      },
      providesTags: ['DashboardKpis'],
    }),

    // ── GET /api/v1/admin/reports/sales ────────────────────────────────────
    // Query params: from (required), to (required), groupBy (optional, default 'day')
    // Response envelope: { data: { report: [{period, revenue, orderCount, aov}] } }
    getSalesReport: builder.query<SalesReportRow[], SalesReportParams>({
      query: ({ from, to, groupBy = 'day' }) => ({
        url: ENDPOINTS.ADMIN.REPORTS_SALES,
        params: { from, to, groupBy },
      }),
      transformResponse: (response: unknown): SalesReportRow[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          const data = r.data as Record<string, unknown> | undefined;
          // Envelope: { data: { report: [...] } }
          if (Array.isArray(data?.report)) return data.report as SalesReportRow[];
          // Fallback: { data: [...] }
          if (Array.isArray(data)) return data as SalesReportRow[];
        }
        return [];
      },
    }),

    // ── GET /api/v1/admin/orders ────────────────────────────────────────────
    // Query params: limit, sort, page, status, etc.
    // Response envelope: { data: { orders: [...] }, meta: { pagination: {...} } }
    getRecentOrders: builder.query<RecentOrderPayload[], void>({
      query: () => ({
        url: ENDPOINTS.ADMIN.ORDERS,
        params: { limit: 5, page: 1 },
      }),
      transformResponse: (response: unknown): RecentOrderPayload[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          const data = r.data as Record<string, unknown> | undefined;
          // Envelope: { data: { orders: [...] } }
          if (Array.isArray(data?.orders)) return data.orders as RecentOrderPayload[];
          // Fallback: { data: [...] }
          if (Array.isArray(data)) return data as RecentOrderPayload[];
        }
        return [];
      },
      providesTags: ['AdminOrders'],
    }),

    // ── GET /api/v1/admin/orders/:id ────────────────────────────────────────
    getOrderById: builder.query<RecentOrderPayload, string>({
      query: (id) => ({ url: `${ENDPOINTS.ADMIN.ORDERS}/${id}` }),
      transformResponse: (response: unknown): RecentOrderPayload => {
        const r = response as Record<string, unknown>;
        const data = r.data as Record<string, unknown> | undefined;
        return (data?.order ?? data ?? response) as RecentOrderPayload;
      },
    }),

  }),
});

export const {
  useGetDashboardKpisQuery,
  useGetSalesReportQuery,
  useGetRecentOrdersQuery,
  useGetOrderByIdQuery,
} = adminOrdersApi;
