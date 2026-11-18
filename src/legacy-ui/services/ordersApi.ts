import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';
import { ENDPOINTS } from '../constants/endpoints';

// ── Data interfaces ───────────────────────────────────────────────────────────

export interface OrderItem {
  _id?: string;
  productId: string | { _id: string; title?: string; name?: string; slug?: string };
  variantId?: string;
  productTitle?: string;
  productImage?: string | null;
  name: string; // name of product
  image?: string; // fallback alias
  sku?: string;
  size?: string;
  color?: string;
  fabric?: string;
  quantity: number;
  unitPrice: number;
  price: number; // price per item
  mrp?: number | null;
  lineTotal?: number;
}

export interface OrderShippingAddress {
  name: string;
  fullName?: string;
  addressLine: string;
  line1?: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  deliveryPhone?: string | null;
}

export interface OrderStatusHistoryEntry {
  status: string;
  timestamp: string;
  actorId?: string | null;
  actorEmail?: string | null;
  note?: string | null;
}

export interface OrderCustomer {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId?: OrderCustomer | string | null;
  guestEmail?: string | null;
  items: OrderItem[];
  shippingAddress: OrderShippingAddress;
  couponId?: string | null;
  couponCode?: string | null;
  discountAmount?: number;
  discount: number; // fallback alias
  shippingCharge?: number;
  taxAmount?: number;
  subtotal: number;
  total: number;
  paymentMethod: 'online' | 'cod';
  paymentId?: string | null;
  status:
    | 'Created'
    | 'Pending'
    | 'Paid'
    | 'Failed'
    | 'Processing'
    | 'Packed'
    | 'ReadyToShip'
    | 'Shipped'
    | 'OutForDelivery'
    | 'Delivered'
    | 'FailedDelivery'
    | 'RTO'
    | 'ExchangeRequested'
    | 'ExchangeApproved'
    | 'ExchangeRejected'
    | 'ExchangePickupScheduled'
    | 'ExchangeInTransit'
    | 'ReplacementShipped'
    | 'ExchangeCompleted'
    | 'Cancelled'
    | 'Refunded';
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded';
  statusHistory?: OrderStatusHistoryEntry[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface AdminOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  orderNumber?: string;
  search?: string;
  userId?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

export interface PaginatedOrdersResponse {
  data: Order[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ── Normalize helper for order item ──────────────────────────────────────────
function normalizeOrderItem(item: any): OrderItem {
  const title =
    item.productTitle ||
    item.name ||
    (typeof item.productId === 'object' ? item.productId?.title || item.productId?.name : 'Product');
  const price = item.unitPrice ?? item.price ?? 0;
  const image = item.productImage ?? item.image ?? '';

  return {
    ...item,
    name: title,
    productTitle: title,
    unitPrice: price,
    price: price,
    image: image,
    productImage: image,
    quantity: item.quantity ?? 1,
    lineTotal: item.lineTotal ?? price * (item.quantity ?? 1),
  };
}

function normalizeOrder(order: any): Order {
  if (!order) return order;
  const items = Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [];
  const discount = order.discountAmount ?? order.discount ?? 0;
  const paymentStatus =
    order.paymentStatus || (['Paid', 'Delivered', 'Processing', 'Packed', 'ReadyToShip', 'Shipped', 'OutForDelivery'].includes(order.status) ? 'Paid' : order.status === 'Cancelled' ? 'Cancelled' : 'Pending');

  return {
    ...order,
    items,
    discount,
    discountAmount: discount,
    paymentMethod: order.paymentMethod || 'online',
    paymentStatus,
  };
}

// ── RTK Query Slice ───────────────────────────────────────────────────────────

export const ordersApi = createApi({
  reducerPath: 'ordersApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Orders', 'AdminOrders'],
  endpoints: (builder) => ({
    // ── Customer: get my orders
    getMyOrders: builder.query<Order[], MyOrdersParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ORDERS,
        params: params
          ? {
              ...(params.page !== undefined && { page: params.page }),
              ...(params.limit !== undefined && { limit: params.limit }),
              ...(params.status && { status: params.status }),
            }
          : undefined,
      }),
      transformResponse: (response: unknown): Order[] => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.orders)) return inner.orders.map(normalizeOrder);
            if (Array.isArray(inner.data)) return inner.data.map(normalizeOrder);
          }
          if (Array.isArray(r.data)) return r.data.map(normalizeOrder);
          if (Array.isArray(r.orders)) return r.orders.map(normalizeOrder);
        }
        if (Array.isArray(response)) return response.map(normalizeOrder);
        return [];
      },
      providesTags: ['Orders'],
    }),

    // ── Customer: get single order by ID
    getMyOrderById: builder.query<Order, string>({
      query: (id) => `${ENDPOINTS.ORDERS}/${id}`,
      transformResponse: (response: unknown): Order => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.order) return normalizeOrder(inner.order);
          }
          if (r.order) return normalizeOrder(r.order);
        }
        return normalizeOrder(response);
      },
      providesTags: (_result, _error, id) => [{ type: 'Orders', id }],
    }),

    // ── Customer: cancel order
    cancelOrder: builder.mutation<Order, string>({
      query: (id) => ({
        url: `${ENDPOINTS.ORDERS}/${id}/cancel`,
        method: 'POST',
      }),
      transformResponse: (response: unknown): Order => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object' && (r.data as Record<string, unknown>).order) {
            return normalizeOrder((r.data as Record<string, unknown>).order);
          }
        }
        return normalizeOrder(response);
      },
      invalidatesTags: ['Orders', 'AdminOrders'],
    }),

    // ── Customer: coupon validation
    validateCoupon: builder.mutation<
      { discountAmount: number; isFreeShipping?: boolean; code?: string; message?: string },
      { code: string; cartTotal?: number; cartItems?: Array<{ productId: string; variantId?: string; unitPrice: number; quantity: number }> }
    >({
      query: (body) => ({
        url: ENDPOINTS.COUPONS_VALIDATE,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            return r.data as { discountAmount: number; isFreeShipping?: boolean };
          }
        }
        return response as { discountAmount: number; isFreeShipping?: boolean };
      },
    }),

    // ── Admin: list all orders (paginated, filtered, searched)
    getAdminOrders: builder.query<PaginatedOrdersResponse, AdminOrdersParams | void>({
      query: (params) => ({
        url: ENDPOINTS.ADMIN.ORDERS,
        params: params
          ? {
              ...(params.page !== undefined && { page: params.page }),
              ...(params.limit !== undefined && { limit: params.limit }),
              ...(params.status && params.status !== 'ALL' && { status: params.status }),
              ...(params.orderNumber && { orderNumber: params.orderNumber.trim() }),
              ...(params.search && { orderNumber: params.search.trim() }),
              ...(params.userId && { userId: params.userId }),
              ...(params.paymentMethod && params.paymentMethod !== 'ALL' && { paymentMethod: params.paymentMethod }),
              ...(params.dateFrom && { dateFrom: params.dateFrom }),
              ...(params.dateTo && { dateTo: params.dateTo }),
            }
          : undefined,
      }),
      transformResponse: (response: unknown): PaginatedOrdersResponse => {
        const fallbackPagination = { total: 0, page: 1, limit: 20, totalPages: 0 };
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          // Shape: { data: { orders: [...] }, meta: { total, page, limit, totalPages } }
          if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
            const inner = r.data as Record<string, unknown>;
            if (Array.isArray(inner.orders)) {
              const meta = (r.meta as { pagination?: typeof fallbackPagination; total?: number; page?: number; limit?: number; totalPages?: number } | undefined);
              const pagination = meta?.pagination ?? (meta?.total !== undefined ? { total: meta.total, page: meta.page || 1, limit: meta.limit || 20, totalPages: meta.totalPages || 1 } : fallbackPagination);
              return { data: inner.orders.map(normalizeOrder), pagination };
            }
          }
          if (Array.isArray(r.data)) {
            return { data: r.data.map(normalizeOrder), pagination: (r.pagination as typeof fallbackPagination) ?? fallbackPagination };
          }
        }
        return { data: [], pagination: fallbackPagination };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((o) => ({ type: 'AdminOrders' as const, id: o._id })),
              'AdminOrders',
            ]
          : ['AdminOrders'],
    }),

    // ── Admin: get order by id
    getAdminOrderById: builder.query<Order, string>({
      query: (id) => ({
        url: ENDPOINTS.ADMIN.ORDER_DETAIL(id),
      }),
      transformResponse: (response: unknown): Order => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.order) {
              const norm = normalizeOrder(inner.order);
              if (inner.exchange) (norm as any).exchange = inner.exchange;
              return norm;
            }
          }
          if (r.order) {
            const norm = normalizeOrder(r.order);
            if (r.exchange) (norm as any).exchange = r.exchange;
            return norm;
          }
        }
        return normalizeOrder(response);
      },

      providesTags: (_result, _error, id) => [{ type: 'AdminOrders', id }],
    }),

    // ── Admin: update order status
    updateOrderStatus: builder.mutation<Order, { id: string; status: string; note?: string }>({
      query: ({ id, status, note }) => ({
        url: ENDPOINTS.ADMIN.ORDER_STATUS(id),
        method: 'PATCH',
        body: { status, ...(note ? { note } : {}) },
      }),
      transformResponse: (response: unknown): Order => {
        if (response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (r.data && typeof r.data === 'object') {
            const inner = r.data as Record<string, unknown>;
            if (inner.order) return normalizeOrder(inner.order);
          }
          if (r.order) return normalizeOrder(r.order);
        }
        return normalizeOrder(response);
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'AdminOrders', id },
        'AdminOrders',
      ],
    }),

    // ── Admin: refund order
    refundOrder: builder.mutation<unknown, { id: string; amount?: number; reason?: string }>({
      query: ({ id, amount, reason }) => ({
        url: ENDPOINTS.ADMIN.ORDER_REFUND(id),
        method: 'POST',
        body: {
          ...(amount !== undefined && { amount }),
          ...(reason && { reason }),
        },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'AdminOrders', id },
        'AdminOrders',
      ],
    }),

    // ── Customer: request exchange

    requestExchange: builder.mutation<
      { exchange: any },
      { orderId: string; itemId: string; reason: string; requestedVariantId?: string }
    >({
      query: ({ orderId, itemId, reason, requestedVariantId }) => ({
        url: `${ENDPOINTS.ORDERS}/${orderId}/items/${itemId}/exchange-request`,
        method: 'POST',
        body: { reason, requestedVariantId },
      }),
      invalidatesTags: ['Orders', 'AdminOrders'],
    }),
  }),
});

export const {
  useGetMyOrdersQuery,
  useGetMyOrderByIdQuery,
  useCancelOrderMutation,
  useValidateCouponMutation,
  useRequestExchangeMutation,
  useGetAdminOrdersQuery,
  useGetAdminOrderByIdQuery,
  useUpdateOrderStatusMutation,
  useRefundOrderMutation,
} = ordersApi;

