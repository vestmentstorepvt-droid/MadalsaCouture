import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Eye,
  Percent,
  IndianRupee,
  Truck,
  CheckCircle2,
  AlertCircle,
  X,
  Hash,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { AppButton } from '../../components/ui/button/AppButton';
import { Pagination } from '../../components/ui/pagination/Pagination';
import {
  useGetCouponsQuery,
  useUpdateCouponMutation,
  useDeleteCouponMutation,
} from '../../services/couponApi';
import type { Coupon, UpdateCouponPayload } from '../../services/couponApi';
import { endOfDayIso, startOfDayIso, toDatetimeLocal } from '../../utils/dateTime';

// ─── Filter dropdown options ──────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: 'All Status', value: 'ALL' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const COUPON_TYPE_OPTIONS = [
  { label: 'All Coupon Types', value: 'ALL' },
  { label: 'Percentage (%)', value: 'percentage' },
  { label: 'Flat Amount (₹)', value: 'flat' },
  { label: 'Free Shipping', value: 'free_shipping' },
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

// ─── Toast Component ──────────────────────────────────────────────────────────
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

// ─── Edit Coupon Modal ────────────────────────────────────────────────────────
interface EditCouponModalProps {
  coupon: Coupon | null;
  onClose: () => void;
  onSave: (id: string, payload: UpdateCouponPayload) => Promise<void>;
  isLoading: boolean;
}

const EditCouponModal: React.FC<EditCouponModalProps> = (props) =>
  props.coupon ? <EditCouponModalContent {...props} coupon={props.coupon} /> : null;

const EditCouponModalContent: React.FC<EditCouponModalProps & { coupon: Coupon }> = ({
  coupon,
  onClose,
  onSave,
  isLoading,
}) => {
  const [form, setForm] = useState({
    code: coupon.code || '',
    type: coupon.type || 'percentage',
    value: coupon.value != null ? String(coupon.value) : '',
    minOrderValue: coupon.minOrderValue != null ? String(coupon.minOrderValue) : '',
    startDate: coupon.startDate ? toDatetimeLocal(coupon.startDate).slice(0, 10) : '',
    endDate: coupon.endDate ? toDatetimeLocal(coupon.endDate).slice(0, 10) : '',
    usageLimitTotal: coupon.usageLimitTotal != null ? String(coupon.usageLimitTotal) : '',
    usageLimitPerCustomer: coupon.usageLimitPerCustomer != null ? String(coupon.usageLimitPerCustomer) : '',
    isActive: coupon.isActive,
  });

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.code.trim()) {
      setError('Coupon code is required');
      return;
    }

    if (form.type !== 'free_shipping') {
      const numVal = Number(form.value);
      if (!form.value || isNaN(numVal) || numVal <= 0) {
        setError('Discount value must be greater than 0');
        return;
      }
      if (form.type === 'percentage' && numVal > 100) {
        setError('Percentage discount cannot exceed 100%');
        return;
      }
    }

    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setError('End date cannot be earlier than start date');
      return;
    }

    for (const [label, raw] of [
      ['Total usage limit', form.usageLimitTotal],
      ['Per-customer limit', form.usageLimitPerCustomer],
    ] as const) {
      if (raw && (!Number.isInteger(Number(raw)) || Number(raw) < 1)) {
        setError(`${label} must be a whole number of at least 1`);
        return;
      }
    }

    const payload: UpdateCouponPayload = {
      code: form.code.trim().toUpperCase(),
      type: form.type as 'percentage' | 'flat' | 'free_shipping',
      ...(form.type !== 'free_shipping' ? { value: Number(form.value) } : { value: undefined }),
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : 0,
      startDate: form.startDate ? startOfDayIso(form.startDate) : null,
      endDate: form.endDate ? endOfDayIso(form.endDate) : null,
      usageLimitTotal: form.usageLimitTotal ? Number(form.usageLimitTotal) : null,
      usageLimitPerCustomer: form.usageLimitPerCustomer ? Number(form.usageLimitPerCustomer) : null,
      isActive: form.isActive,
    };

    await onSave(coupon._id, payload);
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition placeholder:text-slate-400';

  const labelClass = 'text-xs font-semibold text-slate-600 block mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Coupon</h2>
            <p className="text-xs text-slate-500">Update promo rules and validity</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Coupon Code *</label>
              <input
                type="text"
                className={inputClass}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <label className={labelClass}>Discount Type *</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Discount Value {form.type === 'percentage' ? '(%)' : form.type === 'flat' ? '(₹)' : ''}
              </label>
              <input
                type="number"
                className={inputClass}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                disabled={form.type === 'free_shipping'}
                min={0}
                max={form.type === 'percentage' ? 100 : undefined}
                placeholder={form.type === 'free_shipping' ? 'N/A' : 'e.g. 20'}
              />
            </div>

            <div>
              <label className={labelClass}>Min. Order Value (₹)</label>
              <input
                type="number"
                className={inputClass}
                value={form.minOrderValue}
                onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                min={0}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>End / Expiry Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Total Usage Limit</label>
              <input
                type="number"
                className={inputClass}
                value={form.usageLimitTotal}
                onChange={(e) => setForm({ ...form, usageLimitTotal: e.target.value })}
                placeholder="Unlimited"
                min={1}
              />
            </div>

            <div>
              <label className={labelClass}>Limit Per Customer</label>
              <input
                type="number"
                className={inputClass}
                value={form.usageLimitPerCustomer}
                onChange={(e) => setForm({ ...form, usageLimitPerCustomer: e.target.value })}
                placeholder="Unlimited"
                min={1}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
              disabled={isLoading}
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" size="md" isLoading={isLoading}>
              Save Changes
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── View Coupon Details Modal ────────────────────────────────────────────────
interface ViewCouponModalProps {
  coupon: Coupon | null;
  onClose: () => void;
}

const ViewCouponModal: React.FC<ViewCouponModalProps> = ({ coupon, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!coupon) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Not set (Permanent)';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const used = coupon.usageCount ?? coupon.usedCount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-slate-900">Coupon Details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Code Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-pink-50/60 border border-pink-100">
            <div>
              <span className="text-xs font-semibold text-accent uppercase tracking-wider block mb-0.5">
                Promo Code
              </span>
              <span className="text-xl font-bold font-mono text-slate-900">{coupon.code}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-xs font-semibold text-accent hover:bg-pink-50 transition shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 block mb-1">Discount Type</span>
              <span className="font-semibold text-slate-800 capitalize">
                {coupon.type.replace('_', ' ')}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 block mb-1">Benefit</span>
              <span className="font-bold text-accent">
                {coupon.type === 'percentage'
                  ? `${coupon.value}% OFF`
                  : coupon.type === 'flat'
                  ? `₹${coupon.value} OFF`
                  : 'Free Shipping'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 block mb-1">Min. Order Value</span>
              <span className="font-semibold text-slate-800">
                {coupon.minOrderValue ? currency.format(coupon.minOrderValue) : 'No Minimum'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 block mb-1">Status</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  coupon.isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {coupon.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 block mb-1">Total Usage</span>
              <span className="font-semibold text-slate-800">
                {used} / {coupon.usageLimitTotal ?? '∞ Unlimited'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 block mb-1">Per User Limit</span>
              <span className="font-semibold text-slate-800">
                {coupon.usageLimitPerCustomer ? `${coupon.usageLimitPerCustomer} per user` : 'Unlimited'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 col-span-2">
              <span className="text-xs text-slate-500 block mb-1">Validity Period</span>
              <span className="font-medium text-slate-800">
                {formatDate(coupon.startDate)} → {formatDate(coupon.endDate)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <AppButton variant="outline" onClick={onClose}>
            Close
          </AppButton>
        </div>
      </div>
    </div>
  );
};

// ─── Main CouponManagement Component ──────────────────────────────────────────
export const CouponManagement: React.FC = () => {
  const navigate = useNavigate();

  // Local UI state for filters & pagination
  const [searchInput, setSearchInput] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modals & Action States
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [viewingCoupon, setViewingCoupon] = useState<Coupon | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Queries & Mutations
  const { data: couponsResp, isLoading, isFetching, refetch } = useGetCouponsQuery({
    page: currentPage,
    limit: pageSize,
    search: search.trim() || undefined,
    type: typeFilter !== 'ALL' ? typeFilter : undefined,
  });

  const [updateCoupon, { isLoading: isUpdating }] = useUpdateCouponMutation();
  const [deleteCoupon, { isLoading: isDeleting }] = useDeleteCouponMutation();

  const allCoupons: Coupon[] = couponsResp?.coupons ?? [];
  const pagination = couponsResp?.pagination;
  const total = pagination?.total ?? 0;

  // Filter by status if specified in UI
  const filteredCoupons = allCoupons.filter((c) => {
    if (statusFilter === 'active') return c.isActive === true;
    if (statusFilter === 'inactive') return c.isActive === false;
    return true;
  });

  // Summary counts
  const totalRedemptions = allCoupons.reduce(
    (acc, c) => acc + (c.usageCount ?? c.usedCount ?? 0),
    0
  );
  const activeCount = allCoupons.filter((c) => c.isActive).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setCurrentPage(1);
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      await updateCoupon({
        id: coupon._id,
        data: { isActive: !coupon.isActive },
      }).unwrap();
      setToast({
        type: 'success',
        message: `Coupon "${coupon.code}" is now ${!coupon.isActive ? 'Active' : 'Inactive'}.`,
      });
    } catch {
      setToast({
        type: 'error',
        message: 'Failed to update coupon status. Please try again.',
      });
    }
  };

  const handleSaveEdit = async (id: string, payload: UpdateCouponPayload) => {
    try {
      await updateCoupon({ id, data: payload }).unwrap();
      setEditingCoupon(null);
      setToast({
        type: 'success',
        message: 'Coupon updated successfully.',
      });
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setToast({
        type: 'error',
        message: apiErr?.data?.error?.message || apiErr?.data?.message || 'Failed to update coupon.',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteCoupon(deleteTargetId).unwrap();
      setToast({
        type: 'success',
        message: 'Coupon deleted successfully.',
      });
    } catch {
      setToast({
        type: 'error',
        message: 'Failed to delete coupon.',
      });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const badgeForType = (t: Coupon['type']) => {
    switch (t) {
      case 'percentage':
        return 'bg-pink-50 text-accent border border-pink-200/60';
      case 'flat':
        return 'bg-amber-50 text-amber-700 border border-amber-200/60';
      case 'free_shipping':
        return 'bg-sky-50 text-sky-700 border border-sky-200/60';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200/60';
    }
  };

  const discountLabel = (c: Coupon) => {
    if (c.type === 'percentage') return `${c.value}% OFF`;
    if (c.type === 'flat') return `₹${c.value} OFF`;
    if (c.type === 'free_shipping') return 'Free Shipping';
    return '—';
  };

  const formatDateShort = (iso?: string | null) => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      {/* Toast Alert */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Edit Modal */}
      <EditCouponModal
        coupon={editingCoupon}
        onClose={() => setEditingCoupon(null)}
        onSave={handleSaveEdit}
        isLoading={isUpdating}
      />

      {/* View Modal */}
      <ViewCouponModal coupon={viewingCoupon} onClose={() => setViewingCoupon(null)} />

      {/* Delete confirmation dialog */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Delete Coupon</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete this coupon? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <AppButton
                variant="danger"
                size="sm"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
              >
                Yes, Delete
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Coupon Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, monitor, and configure promotional discounts and campaign rules.
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
          <AppButton
            variant="primary"
            size="md"
            onClick={() => navigate('/admin/coupons/create')}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create Coupon
          </AppButton>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Coupons"
          value={total.toLocaleString()}
          changePercentage={0}
          changeText="created coupons"
          icon={Tag}
          iconBgColor="bg-rose-50"
          iconColor="text-accent"
        />
        <StatsCard
          title="Active Campaigns"
          value={activeCount.toLocaleString()}
          changePercentage={0}
          changeText="on current page"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Total Redemptions"
          value={totalRedemptions.toLocaleString()}
          changePercentage={0}
          changeText="used on current page"
          icon={Hash}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by code..."
              className="w-full pl-9 pr-16 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition"
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
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold bg-ink text-white rounded-lg hover:bg-ink-hover transition"
            >
              Go
            </button>
          </form>

          {/* Type Dropdown */}
          <div className="w-full sm:w-48">
            <AppDropdown
              options={COUPON_TYPE_OPTIONS}
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(String(v));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Status Dropdown */}
          <div className="w-full sm:w-40">
            <AppDropdown
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(String(v));
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {(search || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-accent hover:underline font-semibold self-end lg:self-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Coupons Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-4">Coupon Code</th>
                <th className="py-4 px-4">Type</th>
                <th className="py-4 px-4">Discount</th>
                <th className="py-4 px-4">Min. Order</th>
                <th className="py-4 px-4">Usage / Limit</th>
                <th className="py-4 px-4">Validity</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                      <span className="text-sm">Loading coupons...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Tag className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No coupons found</p>
                      <p className="text-xs text-slate-400">
                        {search || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try adjusting your search query or filters.'
                          : 'No discount coupons created yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((c) => {
                  const used = c.usageCount ?? c.usedCount ?? 0;
                  const limit = c.usageLimitTotal;
                  const percentUsed = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

                  return (
                    <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Code */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center px-3 py-1 rounded-lg bg-pink-50 text-accent font-bold font-mono text-xs border border-pink-200/60">
                          {c.code}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeForType(c.type)}`}>
                          {c.type === 'percentage' ? (
                            <>
                              <Percent className="w-3 h-3 mr-1" /> Percentage
                            </>
                          ) : c.type === 'flat' ? (
                            <>
                              <IndianRupee className="w-3 h-3 mr-1" /> Flat
                            </>
                          ) : (
                            <>
                              <Truck className="w-3 h-3 mr-1" /> Free Shipping
                            </>
                          )}
                        </span>
                      </td>

                      {/* Discount Amount */}
                      <td className="py-4 px-4 font-bold text-slate-900">{discountLabel(c)}</td>

                      {/* Min Order */}
                      <td className="py-4 px-4 text-slate-600 text-xs">
                        {c.minOrderValue ? currency.format(c.minOrderValue) : <span className="text-slate-400">No min</span>}
                      </td>

                      {/* Usage */}
                      <td className="py-4 px-4 min-w-36">
                        <div className="text-xs font-semibold text-slate-800">
                          {used} / {limit ?? '∞'}
                        </div>
                        {limit != null && (
                          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full bg-linear-to-r from-ink to-ink-hover rounded-full transition-all"
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Validity Period */}
                      <td className="py-4 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {formatDateShort(c.startDate) || 'Now'} → {formatDateShort(c.endDate) || 'Ongoing'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                            c.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Click to toggle status"
                        >
                          {c.isActive ? (
                            <>
                              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3 h-3 text-rose-600" /> Inactive
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => setViewingCoupon(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-rose-50 transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-accent" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => setEditingCoupon(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-4 h-4 text-purple-500" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(c._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
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
            itemLabel="coupons"
          />
        </div>
      </div>
    </div>
  );
};

export default CouponManagement;
