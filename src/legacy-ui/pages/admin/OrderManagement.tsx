import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  IndianRupee,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { AppButton } from '../../components/ui/button/AppButton';
import { Pagination } from '../../components/ui/pagination/Pagination';
import {
  useGetAdminOrdersQuery,
} from '../../services/ordersApi';
import type { Order } from '../../services/ordersApi';

// ── Status Options ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Created', value: 'Created' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Processing', value: 'Processing' },
  { label: 'Packed', value: 'Packed' },
  { label: 'Ready to Ship', value: 'ReadyToShip' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Out for Delivery', value: 'OutForDelivery' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
  { label: 'Refunded', value: 'Refunded' },
];

const PAYMENT_METHOD_OPTIONS = [
  { label: 'All Payment Methods', value: 'ALL' },
  { label: 'Online (Prepaid)', value: 'online' },
  { label: 'Cash on Delivery (COD)', value: 'cod' },
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

// ── Toast Component ───────────────────────────────────────────────────────────
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

// ── Helper Badge Classes ──────────────────────────────────────────────────────
function statusBadgeClass(status: Order['status']): string {
  switch (status) {
    case 'Delivered':
    case 'ExchangeCompleted':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Paid':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'Processing':
    case 'Packed':
    case 'ReadyToShip':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Shipped':
    case 'OutForDelivery':
    case 'ReplacementShipped':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Pending':
    case 'Created':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Cancelled':
    case 'Failed':
    case 'FailedDelivery':
    case 'ExchangeRejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Refunded':
    case 'RTO':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function getCustomerDetails(order: Order): { name: string; email: string; isGuest: boolean } {
  if (order.userId && typeof order.userId === 'object') {
    return {
      name: order.userId.name || order.shippingAddress?.name || 'Registered Customer',
      email: order.userId.email || '—',
      isGuest: false,
    };
  }
  return {
    name: order.shippingAddress?.name || 'Guest Customer',
    email: order.guestEmail || 'Guest Order',
    isGuest: true,
  };
}

// ── Main Component ────────────────────────────────────────────────────────────
export const OrderManagement: React.FC = () => {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const pageSize = 10;

  const { data, isLoading, isFetching, refetch } = useGetAdminOrdersQuery({
    page: currentPage,
    limit: pageSize,
    status: status !== 'ALL' ? status : undefined,
    orderNumber: search.trim() || undefined,
    paymentMethod: paymentMethod !== 'ALL' ? paymentMethod : undefined,
  });

  const orders = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('ALL');
    setPaymentMethod('ALL');
    setCurrentPage(1);
  };

  const handleCopyOrderNumber = (e: React.MouseEvent, orderNumber: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(orderNumber);
    setCopiedId(orderNumber);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics
  const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;
  const processingCount = orders.filter(
    (o) => ['Paid', 'Processing', 'Packed', 'ReadyToShip', 'Shipped', 'OutForDelivery'].includes(o.status)
  ).length;
  const pageRevenue = orders.reduce((acc, o) => acc + (o.total || 0), 0);

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      {/* Toast Alert */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Order Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track customer orders, monitor fulfillment states, and handle COD/refunds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching && !isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </AppButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Orders"
          value={total.toLocaleString()}
          changePercentage={0}
          changeText="in all time"
          icon={ShoppingBag}
          iconBgColor="bg-pink-50"
          iconColor="text-[#E85D88]"
        />
        <StatsCard
          title="In Progress (Page)"
          value={processingCount.toLocaleString()}
          changePercentage={0}
          changeText="processing or transit"
          icon={Clock}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
        />
        <StatsCard
          title="Delivered (Page)"
          value={deliveredCount.toLocaleString()}
          changePercentage={0}
          changeText="successfully fulfilled"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Page Revenue"
          value={currency.format(pageRevenue)}
          changePercentage={0}
          changeText="across page orders"
          icon={IndianRupee}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order # (e.g. MC-2026)..."
              className="w-full pl-9 pr-16 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold bg-[#E85D88] text-white rounded-lg hover:bg-[#d44874] transition"
            >
              Go
            </button>
          </form>

          {/* Status Dropdown */}
          <div className="w-full sm:w-48">
            <AppDropdown
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => {
                setStatus(String(v));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Payment Method Dropdown */}
          <div className="w-full sm:w-48">
            <AppDropdown
              options={PAYMENT_METHOD_OPTIONS}
              value={paymentMethod}
              onChange={(v) => {
                setPaymentMethod(String(v));
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {(search || status !== 'ALL' || paymentMethod !== 'ALL') && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-[#E85D88] hover:underline font-semibold self-end lg:self-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Orders Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-4">Order #</th>
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Items</th>
                <th className="py-4 px-4">Payment</th>
                <th className="py-4 px-4">Total</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#E85D88]" />
                      <span className="text-sm">Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingBag className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No orders found</p>
                      <p className="text-xs text-slate-400">
                        {search || status !== 'ALL' || paymentMethod !== 'ALL'
                          ? 'Try adjusting your search query or filters.'
                          : 'No customer orders have been placed yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const customer = getCustomerDetails(order);
                  const itemsCount = order.items?.length || 0;
                  const firstItem = order.items?.[0];
                  const firstItemTitle =
                    firstItem?.productTitle || firstItem?.name || (typeof firstItem?.productId === 'object' ? (firstItem.productId as any)?.title : 'Item');

                  return (
                    <tr
                      key={order._id}
                      onClick={() => navigate(`/admin/orders/${order._id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      {/* Order Number */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-[#E85D88]">
                            {order.orderNumber}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyOrderNumber(e, order.orderNumber)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            title="Copy Order #"
                          >
                            {copiedId === order.orderNumber ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              customer.isGuest
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-pink-100 text-[#E85D88]'
                            }`}
                          >
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 text-xs block truncate">
                              {customer.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {customer.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-xs text-slate-500">
                        {formatDate(order.createdAt)}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800 block truncate max-w-44">
                          {firstItemTitle}
                        </span>
                        {itemsCount > 1 && (
                          <span className="text-[11px] text-slate-400">
                            +{itemsCount - 1} more item{itemsCount - 1 > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            order.paymentMethod === 'online'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <CreditCard className="w-3 h-3" />
                          {order.paymentMethod === 'online' ? 'Prepaid' : 'COD'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900 text-sm block">
                          {currency.format(order.total)}
                        </span>
                        {order.discountAmount ? (
                          <span className="text-[11px] text-emerald-600 font-medium">
                            Saved {currency.format(order.discountAmount)}
                          </span>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/orders/${order._id}`);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#E85D88] hover:bg-pink-50 transition"
                            title="View Order Details"
                          >
                            <Eye className="w-4 h-4 text-[#E85D88]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <Pagination
            currentPage={currentPage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemLabel="orders"
          />
        </div>
      </div>
    </div>
  );
};

export default OrderManagement;
