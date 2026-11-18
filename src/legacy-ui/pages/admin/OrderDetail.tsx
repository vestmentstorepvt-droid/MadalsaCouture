import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Package,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  RotateCcw,
  Check,
  Copy,
} from 'lucide-react';
import { AppButton } from '../../components/ui/button/AppButton';
import {
  useGetAdminOrderByIdQuery,
  useUpdateOrderStatusMutation,
  useRefundOrderMutation,

} from '../../services/ordersApi';

// ── State Machine Transitions Matching Backend ────────────────────────────────
const VALID_NEXT_STATUSES: Record<string, string[]> = {
  Created: ['Pending', 'Paid', 'Processing', 'Cancelled'],
  Pending: ['Paid', 'Failed', 'Processing', 'Cancelled'],
  Failed: ['Pending', 'Cancelled'],
  Paid: ['Processing', 'Packed', 'Cancelled', 'Refunded'],
  Processing: ['Packed', 'ReadyToShip', 'Cancelled', 'Refunded'],
  Packed: ['ReadyToShip', 'Shipped', 'Cancelled', 'Refunded'],
  ReadyToShip: ['Shipped', 'OutForDelivery', 'Cancelled', 'Refunded'],
  Shipped: ['OutForDelivery', 'Delivered', 'FailedDelivery', 'RTO', 'Cancelled', 'Refunded'],
  OutForDelivery: ['Delivered', 'FailedDelivery', 'RTO', 'Cancelled', 'Refunded'],
  FailedDelivery: ['OutForDelivery', 'RTO', 'Cancelled', 'Refunded'],
  RTO: ['Refunded', 'Cancelled'],
  Delivered: ['ExchangeRequested', 'Refunded', 'Cancelled'],
  ExchangeRequested: ['ExchangeApproved', 'ExchangeRejected', 'Refunded', 'Cancelled'],
  ExchangeApproved: ['ExchangePickupScheduled', 'Refunded', 'Cancelled'],
  ExchangeRejected: ['ExchangeRequested', 'Refunded', 'Cancelled'],
  ExchangePickupScheduled: ['ExchangeInTransit', 'Refunded', 'Cancelled'],
  ExchangeInTransit: ['ReplacementShipped', 'Refunded', 'Cancelled'],
  ReplacementShipped: ['ExchangeCompleted', 'Refunded', 'Cancelled'],
  ExchangeCompleted: ['Refunded', 'Cancelled'],
  Cancelled: ['Refunded'],
  Refunded: [],
};


const ALL_ORDER_STATUSES = [
  'Created',
  'Pending',
  'Paid',
  'Processing',
  'Packed',
  'ReadyToShip',
  'Shipped',
  'OutForDelivery',
  'Delivered',
  'Cancelled',
  'Refunded',
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
};

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const Toast: React.FC<{ toast: ToastState | null; onClose: () => void }> = ({
  toast,
  onClose,
}) => {
  if (!toast) return null;
  return (
    <div
      role="alert"
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
        toast.type === 'error'
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
      }`}
    >
      {toast.type === 'error' ? (
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
      )}
      <span className="font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-slate-700 ml-2 focus:outline-none"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading, isError, refetch } = useGetAdminOrderByIdQuery(id ?? '');
  const [updateOrderStatus, { isLoading: isUpdatingStatus }] = useUpdateOrderStatusMutation();
  const [refundOrder, { isLoading: isRefunding }] = useRefundOrderMutation();


  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  React.useEffect(() => {
    if (order) {
      setRefundAmount(String(order.total || ''));
    }
  }, [order]);

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Package className="w-8 h-8 text-[#E85D88] animate-bounce" />
          <p className="text-sm font-semibold text-slate-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen p-6 bg-slate-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <p className="text-base font-bold text-slate-800">Order not found or failed to load.</p>
        <div className="flex gap-3">
          <AppButton variant="outline" onClick={() => navigate('/admin/orders')}>
            Back to Orders
          </AppButton>
          <AppButton variant="primary" onClick={() => refetch()}>
            Retry
          </AppButton>
        </div>
      </div>
    );
  }

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) return;

    try {
      await updateOrderStatus({
        id: order._id,
        status: selectedStatus,
        note: statusNote.trim() || undefined,
      }).unwrap();
      setToast({ type: 'success', message: `Order transitioned to ${selectedStatus}` });
      setSelectedStatus('');
      setStatusNote('');
      refetch();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setToast({
        type: 'error',
        message: apiErr?.data?.error?.message || apiErr?.data?.message || 'Failed to update status',
      });
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await refundOrder({
        id: order._id,
        amount: Number(refundAmount) || undefined,
        reason: refundReason.trim() || undefined,
      }).unwrap();
      setToast({ type: 'success', message: 'Refund initiated successfully' });
      setIsRefundModalOpen(false);
      refetch();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setToast({
        type: 'error',
        message: apiErr?.data?.error?.message || apiErr?.data?.message || 'Failed to initiate refund',
      });
    }
  };

  // A known status with no transitions (e.g. Refunded) is terminal; only unknown statuses fall back to the full list.
  const hasTransitionRule = Object.prototype.hasOwnProperty.call(VALID_NEXT_STATUSES, order.status);
  const nextAllowed = VALID_NEXT_STATUSES[order.status] ?? [];
  const isTerminalStatus = hasTransitionRule && nextAllowed.length === 0;
  const customerName =
    (order.userId && typeof order.userId === 'object' ? order.userId.name : null) ||
    order.shippingAddress?.name ||
    'Customer';
  const customerEmail =
    (order.userId && typeof order.userId === 'object' ? order.userId.email : null) ||
    order.guestEmail ||
    '—';

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      {/* Toast Alert */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Refund Modal */}
      {isRefundModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsRefundModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" /> Initiate Refund
              </h3>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={order.total}
                  min={1}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Max refundable: {currency.format(order.total)}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Reason for Refund
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                  placeholder="e.g. Customer return, cancellation prior to dispatch"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
                  disabled={isRefunding}
                >
                  Cancel
                </button>
                <AppButton type="submit" variant="primary" size="sm" isLoading={isRefunding}>
                  Confirm Refund
                </AppButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="p-2 rounded-xl hover:bg-white border border-slate-200 text-slate-600 transition"
            title="Back to Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Order <span className="font-mono text-[#E85D88]">{order.orderNumber}</span>
              </h1>
              <button
                type="button"
                onClick={handleCopyOrderNumber}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
                title="Copy Order #"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Placed on {formatDate(order.createdAt)} • ID: {order._id}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {['Paid', 'Cancelled'].includes(order.status) && (
            <button
              type="button"
              onClick={() => setIsRefundModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Issue Refund
            </button>
          )}

          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${
              order.status === 'Delivered'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : order.status === 'Paid'
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : order.status === 'Cancelled'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Order Items & Pricing Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#E85D88]" />
                Purchased Items ({order.items.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {order.items.map((item, idx) => {
                const title =
                  item.productTitle ||
                  item.name ||
                  (typeof item.productId === 'object' ? (item.productId as any)?.title : 'Item');
                const image = item.productImage || item.image;

                return (
                  <div key={item._id || idx} className="flex items-center gap-4 p-5">
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                      {image ? (
                        <img src={image} alt={title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                        {item.size && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                            Size: {item.size}
                          </span>
                        )}
                        {item.color && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-700">
                            Color: {item.color}
                          </span>
                        )}
                        {item.fabric && <span>• {item.fabric}</span>}
                        {item.sku && <span className="font-mono text-slate-400">SKU: {item.sku}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-900 text-sm">
                        {currency.format((item.unitPrice || item.price || 0) * item.quantity)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {currency.format(item.unitPrice || item.price || 0)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Invoice Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#E85D88]" />
              Payment & Invoice Summary
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium text-slate-800">{currency.format(order.subtotal)}</span>
              </div>

              {order.discountAmount ? (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>
                    Coupon Discount {order.couponCode ? `(${order.couponCode})` : ''}
                  </span>
                  <span>− {currency.format(order.discountAmount)}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-slate-600">
                <span>Shipping Fee</span>
                <span className="font-medium text-slate-800">
                  {order.shippingCharge ? currency.format(order.shippingCharge) : 'Free Shipping'}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="font-bold text-base text-slate-900">Total Charged</span>
                <span className="font-bold text-xl text-[#E85D88]">{currency.format(order.total)}</span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Payment Method</span>
                <span className="font-semibold text-slate-800 uppercase">
                  {order.paymentMethod === 'online' ? 'Online Payment' : 'Cash on Delivery (COD)'}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Exchange Information Card */}
          {((order as any).exchange || order.status.startsWith('Exchange')) && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-6 space-y-3 shadow-sm">
              <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Customer Exchange Information
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-amber-800/80 font-medium shrink-0">Exchange Purpose / Reason:</span>
                  <span className="font-bold text-amber-950 text-right bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200/60">
                    {(order as any).exchange?.reason ||
                      (() => {
                        const rawNote = order.statusHistory?.find(h => h.status === 'ExchangeRequested')?.note;
                        if (!rawNote || rawNote === 'Exchange requested by customer') return 'Size / Variant Exchange Requested';
                        return rawNote.replace('Exchange requested by customer: ', '').replace(/"/g, '');
                      })()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-amber-800/80 font-medium">Exchange Lifecycle Status:</span>
                  <span className="font-semibold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded-md">
                    {(order as any).exchange?.status || order.status}
                  </span>
                </div>
                {(order as any).exchange?.createdAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-amber-800/80 font-medium">Requested On:</span>
                    <span className="text-amber-900 font-semibold">{formatDate((order as any).exchange.createdAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Transition History Audit Trail */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[#E85D88]" />
              Status Audit Trail
            </h2>


            {order.statusHistory && order.statusHistory.length > 0 ? (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {order.statusHistory.map((h, i) => (
                  <div key={i} className="relative flex items-start justify-between gap-4">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#E85D88] ring-4 ring-white" />
                    <div>
                      <span className="text-xs font-bold text-slate-800">{h.status}</span>
                      {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
                      {h.actorEmail && (
                        <p className="text-[11px] text-slate-400">By: {h.actorEmail}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{formatDate(h.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No transition history logged.</p>
            )}
          </div>
        </div>

        {/* Right Column: Customer Details, Address, and Status Transition Controller */}
        <div className="space-y-6">
          {/* Status Transition Controller Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#E85D88]" /> Update Lifecycle Status
            </h2>

            <form onSubmit={handleStatusChange} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Next Status
                </label>
                <select
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                  value={selectedStatus}
                  disabled={isTerminalStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">Select target status...</option>
                  {hasTransitionRule
                    ? nextAllowed.map((st) => (
                        <option key={st} value={st}>
                          {st} (Recommended)
                        </option>
                      ))
                    : ALL_ORDER_STATUSES.filter((st) => st !== order.status).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                </select>
                {isTerminalStatus && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    This order is in a final state and cannot be moved to another status.
                  </p>
                )}
                {nextAllowed.length > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Valid next hops: {nextAllowed.join(' → ')}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Audit Note (Optional)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
                  placeholder="e.g. Dispatched via BlueDart AWB# 12345"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
              </div>

              <AppButton
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                isLoading={isUpdatingStatus}
                disabled={!selectedStatus || isTerminalStatus}
              >
                Transition Order Status
              </AppButton>
            </form>
          </div>

          {/* Customer Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Customer Profile</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-100 text-[#E85D88] flex items-center justify-center font-bold text-sm">
                {customerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{customerName}</p>
                <p className="text-xs text-slate-500 truncate">{customerEmail}</p>
              </div>
            </div>
            {order.shippingAddress?.phone && (
              <p className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                Contact: <span className="font-semibold">{order.shippingAddress.phone}</span>
              </p>
            )}
          </div>

          {/* Shipping Address Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E85D88]" /> Delivery Destination
            </h2>
            {order.shippingAddress ? (
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 text-sm">
                  {order.shippingAddress.name || order.shippingAddress.fullName}
                </p>
                <p>{order.shippingAddress.addressLine || order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {[
                    order.shippingAddress.city,
                    order.shippingAddress.state,
                    order.shippingAddress.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p>{order.shippingAddress.country || 'India'}</p>
                <p className="pt-2 text-slate-500">
                  Phone: <span className="font-semibold text-slate-700">{order.shippingAddress.phone}</span>
                </p>
                {order.shippingAddress.deliveryPhone && (
                  <p className="text-slate-500">
                    Alt Phone: <span className="font-semibold text-slate-700">{order.shippingAddress.deliveryPhone}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No address recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
