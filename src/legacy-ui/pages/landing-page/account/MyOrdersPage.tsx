import React, { useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import {
  Search, PackageOpen, AlertCircle, RefreshCw, Check,
  X, ChevronDown, ChevronUp, ArrowRight, ShoppingBag,
  Truck, MapPin, CreditCard, Tag, RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useGetMyOrdersQuery,
  useCancelOrderMutation,
  useRequestExchangeMutation,
  type Order,
  type OrderItem,
} from '../../../services/ordersApi';
import { optimizeImage } from '../../../utils/imageUtils';
import { CancelHint, CancelOrderSheet, CancellationNote, cancelState } from '../../../components/features/orders/CancelOrder';



// ── Helpers ────────────────────────────────────────────────────────────────────
const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Status badge config ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  Created:        { label: 'Created',         color: 'bg-slate-100 text-slate-700 border-slate-200',  dot: 'bg-slate-400' },
  Pending:        { label: 'Pending',         color: 'bg-amber-50 text-amber-800 border-amber-200',   dot: 'bg-amber-500' },
  Paid:           { label: 'Paid',            color: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  Processing:     { label: 'Processing',      color: 'bg-blue-50 text-blue-800 border-blue-200',      dot: 'bg-blue-500' },
  Packed:         { label: 'Packed',          color: 'bg-indigo-50 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' },
  ReadyToShip:    { label: 'Ready to Ship',   color: 'bg-purple-50 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
  Shipped:        { label: 'Shipped',         color: 'bg-sky-50 text-sky-800 border-sky-200',         dot: 'bg-sky-500' },
  OutForDelivery: { label: 'Out for Delivery', color: 'bg-teal-50 text-teal-800 border-teal-200',     dot: 'bg-teal-500' },
  Delivered:      { label: 'Delivered',       color: 'bg-green-50 text-green-800 border-green-200',   dot: 'bg-green-600' },
  Cancelled:      { label: 'Cancelled',       color: 'bg-rose-50 text-rose-800 border-rose-200',      dot: 'bg-rose-500' },
  Refunded:       { label: 'Refunded',        color: 'bg-orange-50 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' };
}

// ── Toast ──────────────────────────────────────────────────────────────────────
interface Toast { message: string; type: 'success' | 'error' }
const ToastBanner: React.FC<{ toast: Toast | null }> = ({ toast }) => {
  if (!toast) return null;
  return (
    <div role="alert" className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900' : 'bg-rose-50/95 border-rose-200 text-rose-900'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
        {toast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      </div>
      {toast.message}
    </div>
  );
};
function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, show };
}

// ── Exchange Modal ─────────────────────────────────────────────────────────────
const ExchangeModal: React.FC<{
  open: boolean;
  item: OrderItem | null;
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}> = ({ open, item, isSubmitting, onConfirm, onCancel }) => {
  const [category, setCategory] = useState('Size issue (Too large / Too small)');
  const [requestedSize, setRequestedSize] = useState('');
  const [details, setDetails] = useState('');

  if (!open || !item) return null;

  const categories = [
    'Size issue (Too large / Too small)',
    'Color preference',
    'Defective or damaged item',
    'Fabric / fit preference',
    'Wrong item received',
    'Changed mind / Other',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = [category];
    if (requestedSize.trim()) {
      parts.push(`Requested replacement: ${requestedSize.trim()}`);
    }
    if (details.trim()) {
      parts.push(`Notes: ${details.trim()}`);
    }
    const finalReason = parts.join(' - ');
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-serif font-bold text-slate-900 flex items-center gap-2 text-base">
              <RotateCcw className="w-4.5 h-4.5 text-accent" /> Request Item Exchange
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Specify your reason and preferred replacement details.</p>
          </div>
          <button type="button" onClick={onCancel} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Product summary */}
        <div className="bg-surface rounded-2xl border border-hairline p-3.5 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-stone-200">
            {item.productImage || item.image ? (
              <img src={optimizeImage(item.productImage || item.image, 400)} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <ShoppingBag className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-slate-900 truncate">{item.productTitle || item.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Current Size: <span className="font-semibold text-slate-700">{item.size || 'Standard'}</span> • Color: <span className="font-semibold text-slate-700">{item.color || 'Standard'}</span>
            </p>
            <p className="text-xs text-slate-400 font-mono">Qty: {item.quantity}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Category */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Reason for Exchange <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border bg-surface px-3.5 outline-none focus:border-hairline focus:ring-2 focus:ring-hairline transition h-11 rounded-full border-hairline-strong text-ink text-sm font-medium transition-colors hover:bg-hairline-soft"
              required
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Preferred Replacement Size/Variant */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Preferred Replacement Size / Color (Optional)
            </label>
            <input
              type="text"
              value={requestedSize}
              onChange={(e) => setRequestedSize(e.target.value)}
              placeholder="e.g. Need Size L instead of M / Change color to Black"
              className="w-full border bg-surface px-3.5 outline-none focus:border-hairline focus:ring-2 focus:ring-hairline transition h-11 rounded-full border-hairline-strong text-ink text-sm font-medium transition-colors hover:bg-hairline-soft"
            />
          </div>

          {/* Detailed explanation textarea */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Detailed Notes & Explanation <span className="text-slate-400 font-normal">(Recommended)</span>
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide specific details for our client care team (e.g. fitting issue across bust/shoulders, exact defect location, or any special instructions)..."
              className="w-full border bg-surface px-3.5 outline-none focus:border-hairline focus:ring-2 focus:ring-hairline transition resize-none h-11 rounded-full border-hairline-strong text-ink text-sm font-medium transition-colors hover:bg-hairline-soft"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ink text-white text-xs font-semibold hover:bg-ink transition disabled:opacity-60"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {isSubmitting ? 'Submitting…' : 'Submit Exchange Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ── Order Card ─────────────────────────────────────────────────────────────────
const OrderCard: React.FC<{
  order: Order;
  onCancel: (id: string) => void;
  onExchange: (order: Order, item: OrderItem) => void;
  isCancelTarget: boolean;
}> = ({ order, onCancel, onExchange, isCancelTarget }) => {

  const [expanded, setExpanded] = useState(false);
  const statusCfg = getStatusConfig(order.status);
  const canCancel = cancelState(order) === 'can_cancel';
  const firstImage = order.items[0]?.productImage || order.items[0]?.image || '';

  return (
    <div className="rounded-2xl border border-hairline bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-surface border-b border-hairline">
        <div>
          <p className="eyebrow">Order</p>
          <p className="font-mono text-sm font-bold text-slate-900">#{order.orderNumber}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${statusCfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          <div className="text-right">
            <p className="text-xs text-slate-400">Placed</p>
            <p className="text-xs font-semibold text-slate-700">{formatDate(order.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="flex flex-col sm:flex-row items-start gap-4 px-5 py-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
          {firstImage ? (
            <img src={optimizeImage(firstImage, 400)} alt="order" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-slate-300" />
            </div>
          )}
        </div>

        {/* Info grid */}
        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Items</p>
            <p className="text-sm font-semibold text-slate-800 truncate">
              {order.items.length > 1 ? `${order.items.length} items` : (order.items[0]?.productTitle || order.items[0]?.name || 'Product')}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total</p>
            <p className="text-sm font-bold text-ink">{formatINR(order.total)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Payment</p>
            <p className="text-xs font-semibold text-slate-700 capitalize">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Qty</p>
            <p className="text-xs font-semibold text-slate-700">{order.items.reduce((s, i) => s + i.quantity, 0)} units</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Payment Status</p>
            <p className="text-xs font-semibold text-slate-700">{order.paymentStatus}</p>
          </div>
          {order.shippingAddress && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">City</p>
              <p className="text-xs font-semibold text-slate-700">{order.shippingAddress.city}</p>
            </div>
          )}
        </div>
      </div>

      {order.status === 'Cancelled' && (
        <div className="px-5 pb-4">
          <CancellationNote order={order} />
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-hairline px-5 py-4 space-y-4 bg-slate-50/50">
          {/* Items list */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <ShoppingBag className="w-3 h-3" /> Items Ordered
            </p>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700 bg-white rounded-xl px-3 py-2.5 border border-hairline">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.productTitle || item.name}</p>
                    {(item.size || item.color) && (
                      <p className="text-slate-400 mt-0.5">{[item.size, item.color].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-slate-900">×{item.quantity}</p>
                      <p className="text-slate-500">{formatINR(item.unitPrice)}</p>
                    </div>
                    {order.status === 'Delivered' && (
                      <button
                        type="button"
                        onClick={() => onExchange(order, item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-hairline text-xs font-bold text-accent hover:bg-ink/10 transition shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" /> Exchange
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Pricing breakdown */}
          <div className="bg-white rounded-xl border border-hairline p-3 space-y-1.5 text-xs">
            <p className="font-bold text-slate-700 flex items-center gap-1.5 mb-2"><CreditCard className="w-3 h-3" /> Price Breakdown</p>
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
            {!!order.discountAmount && order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Discount</span>
                <span>-{formatINR(order.discountAmount)}</span>
              </div>
            )}
            {!!order.shippingCharge && order.shippingCharge > 0 && (
              <div className="flex justify-between text-slate-600"><span>Shipping</span><span>{formatINR(order.shippingCharge)}</span></div>
            )}
            <div className="flex justify-between font-bold text-slate-900 border-t border-hairline pt-1.5 mt-1">
              <span>Total</span><span>{formatINR(order.total)}</span>
            </div>
          </div>

          {/* Shipping address */}
          {order.shippingAddress && (
            <div className="bg-white rounded-xl border border-hairline p-3 text-xs">
              <p className="font-bold text-slate-700 flex items-center gap-1.5 mb-2"><MapPin className="w-3 h-3" /> Shipping Address</p>
              <p className="text-slate-600 leading-relaxed">
                {order.shippingAddress.name || order.shippingAddress.fullName}<br />
                {[order.shippingAddress.line1 || order.shippingAddress.addressLine, order.shippingAddress.line2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode, order.shippingAddress.country].filter(Boolean).join(', ')}<br />
                <span className="flex items-center gap-1 mt-1"><Truck className="w-3 h-3" />{order.shippingAddress.phone || order.shippingAddress.deliveryPhone}</span>
              </p>
            </div>
          )}

          {/* Tracking Timeline */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-hairline p-4 text-xs">
              <p className="font-bold text-slate-700 flex items-center gap-1.5 mb-4">
                <Truck className="w-3.5 h-3.5" /> Order Tracking
              </p>
              <div className="relative pl-3 space-y-4 before:absolute before:inset-y-2 before:left-[17px] before:w-px before:bg-canvas">
                {order.statusHistory.map((history, idx) => (
                  <div key={idx} className="relative flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-ink ring-4 ring-white z-10 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-800">{getStatusConfig(history.status).label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(history.timestamp).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                      {history.note && (
                        <p className="text-xs text-slate-400 mt-1 italic line-clamp-2">Note: {history.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 border-t h-11 rounded-full border border-hairline-strong bg-surface text-ink text-sm font-medium transition-colors hover:bg-hairline-soft">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent transition"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Hide Details</> : <><ChevronDown className="w-3.5 h-3.5" /> View Details</>}
        </button>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <CancelHint order={order} />
          {canCancel && (
            <button
              type="button"
              onClick={() => onCancel(order._id)}
              disabled={isCancelTarget}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
            >
              {isCancelTarget ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Skeleton ───────────────────────────────────────────────────────────────────
const OrderSkeleton = () => (
  <div className="animate-pulse rounded-2xl border border-hairline bg-white overflow-hidden">
    <div className="h-16 bg-surface border-b border-hairline" />
    <div className="flex gap-4 p-5">
      <div className="w-20 h-20 rounded-xl bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded-full bg-slate-200" />
        <div className="h-4 w-1/4 rounded-full bg-slate-100" />
        <div className="h-4 w-1/2 rounded-full bg-slate-100" />
      </div>
    </div>
  </div>
);

// ── Filters ────────────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { value: 'all', label: 'All Orders' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Processing', label: 'Processing' },
  { value: 'Shipped', label: 'Shipped' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Cancelled', label: 'Cancelled' },
] as const;

type FilterValue = (typeof STATUS_FILTERS)[number]['value'];

// ── Page ──────────────────────────────────────────────────────────────────────
const MyOrdersPage: React.FC = () => {
  const { toast, show: showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortValue, setSortValue] = useState<'newest' | 'oldest' | 'high' | 'low'>('newest');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [exchangeTarget, setExchangeTarget] = useState<{ order: Order; item: OrderItem } | null>(null);

  const PAGE_SIZE = 5;
  const ORDERS_FETCH_LIMIT = 100;

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // GET /api/v1/orders?limit=100 (backend max). Status filtering happens client-side so the
  // stat cards always reflect every order instead of only the selected status.
  const { data: allOrders = [], isLoading, isError, refetch } = useGetMyOrdersQuery(
    { limit: ORDERS_FETCH_LIMIT },
    { skip: !isAuthenticated }
  );

  // POST /api/v1/orders/:id/cancel  Body: none
  // Response: { data: { order: Order } }
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();

  // POST /api/v1/orders/:orderId/items/:itemId/exchange-request
  const [requestExchange, { isLoading: isExchanging }] = useRequestExchangeMutation();

  // ── Filter + sort + paginate ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    const searched = allOrders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!s) return true;
      return o.orderNumber.toLowerCase().includes(s) ||
        o.items.some(i => (i.productTitle || i.name || '').toLowerCase().includes(s));
    });
    return [...searched].sort((a, b) => {
      if (sortValue === 'high') return b.total - a.total;
      if (sortValue === 'low') return a.total - b.total;
      if (sortValue === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [allOrders, statusFilter, searchTerm, sortValue]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: allOrders.length,
    pending: allOrders.filter(o => ['Created', 'Pending'].includes(o.status)).length,
    active: allOrders.filter(o => ['Processing', 'Packed', 'Shipped', 'OutForDelivery'].includes(o.status)).length,
    delivered: allOrders.filter(o => o.status === 'Delivered').length,
  }), [allOrders]);

  // ── Cancel handler ────────────────────────────────────────────────────────
  const handleCancel = async (reason: string, note: string) => {
    if (!cancelTarget) return;
    try {
      await cancelOrder({ id: cancelTarget, reason, note }).unwrap();
      showToast("Your order has been cancelled. We've emailed you a confirmation.");
      refetch();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      showToast(e?.data?.message ?? 'Failed to cancel order.', 'error');
    } finally {
      setCancelTarget(null);
    }
  };

  // ── Exchange handler ──────────────────────────────────────────────────────
  const handleExchange = async (reason: string) => {
    if (!exchangeTarget) return;
    try {
      const itemId = exchangeTarget.item._id || exchangeTarget.item.variantId || exchangeTarget.item.productId;
      await requestExchange({
        orderId: exchangeTarget.order._id,
        itemId: typeof itemId === 'object' && itemId !== null ? String((itemId as { _id?: string })._id ?? '') : String(itemId),
        reason,
      }).unwrap();
      showToast('Exchange request submitted successfully! Our client care team will contact you for pickup.');
      refetch();
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      showToast(e?.data?.message ?? 'Failed to submit exchange request.', 'error');
    } finally {
      setExchangeTarget(null);
    }
  };


  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.1),_transparent_28%),linear-gradient(145deg,_#FFF9F1_0%,_#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <ToastBanner toast={toast} />

      <div className="mx-auto max-w-4xl space-y-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="pt-8">
          <p className="eyebrow">Luxury Client Care</p>
          <h1 className="text-4xl text-slate-900 mt-1 font-semibold">My Orders</h1>
          <div className="h-0.5 w-12 bg-ink mt-3" />
        </div>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-800 bg-white' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-800 bg-amber-50' },
            { label: 'Active', value: stats.active, color: 'text-blue-800 bg-blue-50' },
            { label: 'Delivered', value: stats.delivered, color: 'text-green-800 bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`${s.color}rounded-2xl border px-4 h-11 rounded-full border-hairline-strong bg-surface text-ink text-sm font-medium transition-colors hover:bg-hairline-soft`}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-70">{s.label}</p>
              <p className="text-2xl font-black mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Filter bar ───────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => { setStatusFilter(f.value); setPage(1); }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition ${statusFilter === f.value ? 'bg-ink text-accent' : 'border border-hairline bg-white text-slate-600 hover:border-hairline'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 flex items-center gap-2 rounded-2xl border bg-white px-4 text-sm h-11 rounded-full border-hairline-strong bg-surface text-ink font-medium transition-colors hover:bg-hairline-soft">
              <Search className="w-4 h-4 text-accent flex-shrink-0" />
              <input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Search by order # or product name…"
                className="bg-transparent outline-none flex-1 text-slate-700 placeholder:text-slate-400 text-sm"
              />
            </label>
            <select
              value={sortValue}
              onChange={(e) => { setSortValue(e.target.value as typeof sortValue); setPage(1); }}
              className="rounded-2xl border bg-white px-4 text-sm text-slate-700 outline-none cursor-pointer h-11 rounded-full border-hairline-strong bg-surface text-ink font-medium transition-colors hover:bg-hairline-soft"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="high">Total: High → Low</option>
              <option value="low">Total: Low → High</option>
            </select>
            <button type="button" onClick={() => refetch()} className="flex items-center gap-1.5 px-4 rounded-2xl border bg-white text-sm text-slate-500 hover:text-accent transition h-11 rounded-full border-hairline-strong bg-surface text-ink font-medium transition-colors hover:bg-hairline-soft">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* ── Orders list ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <OrderSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-8 py-14 text-center">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-rose-700">Failed to load orders.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-ink/10 flex items-center justify-center mx-auto">
              <PackageOpen className="w-8 h-8 text-accent" />
            </div>
            <h2 className="font-serif text-2xl text-slate-800">No orders found</h2>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              {searchTerm ? `No orders match "${searchTerm}"` : 'Your order history will appear here.'}
            </p>
            {!searchTerm && (
              <Link to="/products" className="inline-flex items-center gap-2 mt-2 bg-ink px-8 text-white h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover">
                Start Shopping <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {paginated.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onCancel={(id) => setCancelTarget(id)}
                onExchange={(ord, item) => setExchangeTarget({ order: ord, item })}
                isCancelTarget={cancelTarget === order._id && isCancelling}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 border text-sm text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition h-11 rounded-full border-hairline-strong bg-surface text-ink font-medium transition-colors hover:bg-hairline-soft"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 border text-sm text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition h-11 rounded-full border-hairline-strong bg-surface text-ink font-medium transition-colors hover:bg-hairline-soft"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel sheet: items, required reason, what happens to the money */}
      <CancelOrderSheet
        order={allOrders.find((o) => o._id === cancelTarget) ?? null}
        isSubmitting={isCancelling}
        onConfirm={(reason, note) => void handleCancel(reason, note)}
        onClose={() => setCancelTarget(null)}
      />

      {/* Exchange modal */}
      <ExchangeModal
        open={exchangeTarget !== null}
        item={exchangeTarget?.item ?? null}
        isSubmitting={isExchanging}
        onConfirm={(reason) => void handleExchange(reason)}
        onCancel={() => setExchangeTarget(null)}
      />
    </div>

  );
};

export default MyOrdersPage;
