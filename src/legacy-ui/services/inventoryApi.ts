import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

export type InventoryReasonCode =
  | 'purchase'
  | 'return'
  | 'adjustment'
  | 'damaged'
  | 'loss'
  | 'found';

export interface InventoryItem {
  _id?: string;
  variantId: string;
  productId?: string | { _id: string; title?: string; name?: string; slug?: string; images?: Array<{ url: string }> };
  productName: string;
  sku?: string;
  size?: string;
  color?: string;
  fabric?: string;
  price?: number;
  stock: number;
  reservedStock?: number;
  availableStock?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryParams {
  threshold?: number;
}

export interface AdjustInventoryPayload {
  variantId: string;
  delta: number;
  reasonCode: InventoryReasonCode | string;
  note?: string;
}

export interface InventoryAuditLog {
  _id: string;
  variantId: string;
  delta: number;
  reasonCode: InventoryReasonCode | string;
  note?: string | null;
  actorId?: string;
  actorEmail?: string;
  timestamp: string;
}

export interface PaginatedInventoryLogResponse {
  data: InventoryAuditLog[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface InventoryReportResponse {
  zeroStock: InventoryItem[];
  lowStock: InventoryItem[];
}

function normalizeInventoryVariant(v: any): InventoryItem {
  const variantId = v.variantId || v._id;
  let productName = v.productName;
  if (!productName && v.productId && typeof v.productId === 'object') {
    productName = v.productId.title || v.productId.name || 'Product';
  } else if (!productName) {
    productName = 'Product Variant';
  }

  const stock = typeof v.stock === 'number' ? v.stock : 0;
  const reservedStock = typeof v.reservedStock === 'number' ? v.reservedStock : 0;
  const availableStock = v.availableStock ?? Math.max(0, stock - reservedStock);

  return {
    ...v,
    variantId,
    _id: variantId,
    productName,
    stock,
    reservedStock,
    availableStock,
  };
}

export const inventoryApi = createApi({
  reducerPath: 'inventoryApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Inventory', 'InventoryLogs'],
  endpoints: (builder) => ({
    getInventory: builder.query<InventoryItem[], InventoryParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.INVENTORY,
        params: params && (params as InventoryParams).threshold !== undefined
          ? { threshold: (params as InventoryParams).threshold }
          : undefined,
      }),
      transformResponse: (response: unknown): InventoryItem[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;

          // Shape: { data: { variants: [...] } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.variants)) return inner.variants.map(normalizeInventoryVariant);
            if (Array.isArray(inner.items)) return inner.items.map(normalizeInventoryVariant);
          }

          // Shape: { data: [...] }
          if (Array.isArray(r.data)) return r.data.map(normalizeInventoryVariant);
          if (Array.isArray(r.variants)) return r.variants.map(normalizeInventoryVariant);
        }

        if (Array.isArray(response)) return response.map(normalizeInventoryVariant);
        return [];
      },
      providesTags: ['Inventory'],
    }),

    adjustInventory: builder.mutation<InventoryItem, AdjustInventoryPayload>({
      query: ({ variantId, ...body }) => ({
        url: ENDPOINTS.ADMIN.INVENTORY_ADJUST(variantId),
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: unknown): InventoryItem => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).variant) {
            return normalizeInventoryVariant((r.data as Record<string, unknown>).variant);
          }
        }
        return normalizeInventoryVariant(response);
      },
      invalidatesTags: (_result, _error, { variantId }) => [
        'Inventory',
        { type: 'InventoryLogs', id: variantId },
      ],
    }),

    getInventoryLog: builder.query<
      PaginatedInventoryLogResponse,
      { variantId: string; page?: number; limit?: number }
    >({
      query: ({ variantId, page = 1, limit = 20 }) => ({
        url: ENDPOINTS.ADMIN.INVENTORY_LOG(variantId),
        params: { page, limit },
      }),
      transformResponse: (response: unknown): PaginatedInventoryLogResponse => {
        const fallback = { page: 1, limit: 20, total: 0, totalPages: 1 };
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            const meta = inner.meta as { pagination?: typeof fallback } | undefined;
            const pagination = meta?.pagination ?? fallback;
            const logs = Array.isArray(inner.data) ? (inner.data as InventoryAuditLog[]) : [];
            return { data: logs, pagination };
          }
          if (Array.isArray(r.data)) {
            const meta = r.meta as { pagination?: typeof fallback } | undefined;
            return { data: r.data as InventoryAuditLog[], pagination: meta?.pagination ?? fallback };
          }
        }
        return { data: [], pagination: fallback };
      },
      providesTags: (_result, _error, { variantId }) => [{ type: 'InventoryLogs', id: variantId }],
    }),

    getInventoryReport: builder.query<InventoryReportResponse, void>({
      query: () => ENDPOINTS.ADMIN.REPORTS_INVENTORY,
      transformResponse: (response: unknown): InventoryReportResponse => {
        const empty: InventoryReportResponse = { zeroStock: [], lowStock: [] };
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          const data = r.data as InventoryReportResponse | undefined;
          if (data?.zeroStock && data?.lowStock) {
            return {
              zeroStock: data.zeroStock.map(normalizeInventoryVariant),
              lowStock: data.lowStock.map(normalizeInventoryVariant),
            };
          }
        }
        return empty;
      },
      providesTags: ['Inventory'],
    }),
  }),
});

export const {
  useGetInventoryQuery,
  useAdjustInventoryMutation,
  useGetInventoryLogQuery,
  useGetInventoryReportQuery,
} = inventoryApi;
