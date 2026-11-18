import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Eye,
  ShieldAlert,
  ShieldCheck,
  X,
  Mail,
  Phone,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { AppButton } from '../../components/ui/button/AppButton';
import { Pagination } from '../../components/ui/pagination/Pagination';
import {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useUpdateUserStatusMutation,
} from '../../services/userApi';
import type { CustomerUser } from '../../services/userApi';

// ─── Filter dropdown options ──────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: 'All Status', value: 'ALL' },
  { label: 'Active', value: 'active' },
  { label: 'Blocked', value: 'blocked' },
];

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

// ─── Customer Details Modal ───────────────────────────────────────────────────
interface CustomerDetailModalProps {
  userId: string | null;
  onClose: () => void;
  onToggleStatus: (user: CustomerUser) => Promise<void>;
  isUpdatingStatus: boolean;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  userId,
  onClose,
  onToggleStatus,
  isUpdatingStatus,
}) => {
  const [copied, setCopied] = useState(false);
  const { data: user, isLoading, isError, refetch } = useGetUserByIdQuery(userId ?? '', {
    skip: !userId,
  });

  if (!userId) return null;

  const handleCopyId = () => {
    if (user?._id) {
      navigator.clipboard.writeText(user._id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return 'Never';
    try {
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-[#E85D88] flex items-center justify-center font-bold text-base">
              {user?.name ? user.name.charAt(0).toUpperCase() : <Users className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Customer Details</h2>
              <p className="text-xs text-slate-500">View complete account and profile details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="space-y-4 py-8">
              <div className="animate-pulse flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="h-20 bg-slate-100 rounded-xl" />
                <div className="h-20 bg-slate-100 rounded-xl" />
              </div>
            </div>
          ) : isError || !user ? (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm font-medium text-slate-700">Failed to load customer information.</p>
              <AppButton variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
              </AppButton>
            </div>
          ) : (
            <>
              {/* Profile Overview Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">{user.name}</span>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        user.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {user.status === 'active' ? 'Active' : 'Blocked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <span>ID: {user._id}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 text-slate-400 hover:text-slate-700 transition"
                      title="Copy ID"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <AppButton
                  variant={user.status === 'active' ? 'danger' : 'primary'}
                  size="sm"
                  isLoading={isUpdatingStatus}
                  onClick={() => onToggleStatus(user)}
                >
                  {user.status === 'active' ? (
                    <>
                      <ShieldAlert className="w-4 h-4 mr-1.5" /> Block Account
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-1.5" /> Unblock Account
                    </>
                  )}
                </AppButton>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email & Verification */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Mail className="w-4 h-4 text-[#E85D88]" /> Email Address
                  </div>
                  <p className="text-sm font-medium text-slate-800 break-all">{user.email}</p>
                  <div className="pt-1">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.isEmailVerified || user.emailVerified
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {user.isEmailVerified || user.emailVerified ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" /> Unverified
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Phone */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Phone className="w-4 h-4 text-[#E85D88]" /> Phone Number
                  </div>
                  <p className="text-sm font-medium text-slate-800">
                    {user.phone ? user.phone : <span className="text-slate-400">Not provided</span>}
                  </p>
                  <p className="text-xs text-slate-400">Auth Provider: {user.authProvider || 'local'}</p>
                </div>

                {/* Registration Date */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-[#E85D88]" /> Account Created
                  </div>
                  <p className="text-sm font-medium text-slate-800">{formatDate(user.createdAt)}</p>
                  <p className="text-xs text-slate-400">Role: {user.role || 'USER'}</p>
                </div>

                {/* Last Login */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-[#E85D88]" /> Last Login
                  </div>
                  <p className="text-sm font-medium text-slate-800">{formatDate(user.lastLoginAt)}</p>
                  <p className="text-xs text-slate-400">
                    Wishlist items: {user.wishlist?.length ?? 0}
                  </p>
                </div>
              </div>

              {/* Address Details */}
              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-[#E85D88]" /> Primary Address
                </div>
                {user.address && (user.address.addressLine || user.address.city) ? (
                  <div className="text-sm text-slate-700 space-y-0.5">
                    {user.address.addressLine && <p>{user.address.addressLine}</p>}
                    <p>
                      {[user.address.city, user.address.state, user.address.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {user.address.country && (
                      <p className="text-xs text-slate-500 font-medium">{user.address.country}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No primary address registered.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <AppButton variant="outline" onClick={onClose}>
            Close
          </AppButton>
        </div>
      </div>
    </div>
  );
};

// ─── Status Confirmation Dialog ───────────────────────────────────────────────
interface StatusConfirmModalProps {
  user: CustomerUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

const StatusConfirmModal: React.FC<StatusConfirmModalProps> = ({
  user,
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  if (!isOpen || !user) return null;
  const isBlocking = user.status === 'active';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
              isBlocking ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            {isBlocking ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {isBlocking ? 'Block Customer Account' : 'Unblock Customer Account'}
            </h3>
            <p className="text-sm text-slate-500">
              {isBlocking
                ? `Are you sure you want to block ${user.name}? Blocked users cannot log in to the storefront.`
                : `Are you sure you want to unblock ${user.name}? This will restore their access immediately.`}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <AppButton variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </AppButton>
          <AppButton
            variant={isBlocking ? 'danger' : 'primary'}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {isBlocking ? 'Yes, Block Account' : 'Yes, Unblock Account'}
          </AppButton>
        </div>
      </div>
    </div>
  );
};

// ─── Main UserManagement Component ───────────────────────────────────────────
export const UserManagement: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal and toast states
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<CustomerUser | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const itemsPerPage = 10;

  // RTK Query hooks
  const { data: userData, isLoading, isFetching, refetch } = useGetUsersQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm,
    status: selectedStatus,
  });

  const [updateUserStatus, { isLoading: isUpdatingStatus }] = useUpdateUserStatusMutation();

  const usersList = userData?.users ?? [];
  const pagination = userData?.pagination;
  const totalUsers = pagination?.total ?? 0;

  // Derive counts
  const activeCount = usersList.filter((u) => u.status === 'active').length;
  const blockedCount = usersList.filter((u) => u.status === 'blocked').length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setCurrentPage(1);
  };

  const handleStatusChange = (statusValue: string) => {
    setSelectedStatus(statusValue);
    setCurrentPage(1);
  };

  const handleToggleStatusAction = async (user: CustomerUser) => {
    const nextStatus = user.status === 'active' ? 'blocked' : 'active';
    try {
      await updateUserStatus({ id: user._id, status: nextStatus }).unwrap();
      setToast({
        type: 'success',
        message: `Customer ${user.name} has been ${nextStatus === 'blocked' ? 'blocked' : 'unblocked'}.`,
      });
      setConfirmUser(null);
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setToast({
        type: 'error',
        message:
          apiErr?.data?.error?.message ||
          apiErr?.data?.message ||
          'Failed to update customer status. Please try again.',
      });
    }
  };

  const formatDate = (iso: string) => {
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
    <div className="p-6 space-y-6 min-h-screen bg-slate-50 text-slate-800">
      {/* Toast Alert */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Detail Modal */}
      <CustomerDetailModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onToggleStatus={async (user) => {
          // Always go through the confirmation dialog before blocking/unblocking
          setSelectedUserId(null);
          setConfirmUser(user);
        }}
        isUpdatingStatus={isUpdatingStatus}
      />

      {/* Confirmation Dialog */}
      <StatusConfirmModal
        user={confirmUser}
        isOpen={Boolean(confirmUser)}
        onClose={() => setConfirmUser(null)}
        onConfirm={async () => {
          if (confirmUser) {
            await handleToggleStatusAction(confirmUser);
          }
        }}
        isLoading={isUpdatingStatus}
      />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor registered customer accounts, view details, and manage access statuses.
          </p>
        </div>
        <AppButton
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          isLoading={isFetching && !isLoading}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh List
        </AppButton>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Customers"
          value={totalUsers.toLocaleString()}
          changePercentage={0}
          changeText="registered accounts"
          icon={Users}
          iconBgColor="bg-rose-50"
          iconColor="text-[#E85D88]"
        />
        <StatsCard
          title="Active Accounts (Page)"
          value={activeCount.toLocaleString()}
          changePercentage={0}
          changeText="in current view"
          icon={UserCheck}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Blocked Accounts (Page)"
          value={blockedCount.toLocaleString()}
          changePercentage={0}
          changeText="in current view"
          icon={UserX}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* Controls Bar: Search & Status Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by customer name or email..."
              className="w-full pl-9 pr-20 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-semibold bg-[#E85D88] text-white rounded-lg hover:bg-[#d44874] transition"
            >
              Go
            </button>
          </form>

          {/* Status Dropdown */}
          <div className="w-full sm:w-44">
            <AppDropdown
              options={STATUS_OPTIONS}
              value={selectedStatus}
              onChange={(value) => handleStatusChange(String(value))}
            />
          </div>
        </div>

        {searchTerm && (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>
              Searching for: <strong className="text-slate-800">"{searchTerm}"</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="text-[#E85D88] hover:underline font-medium"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Customers Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-4">User ID</th>
                <th className="py-4 px-4">Name</th>
                <th className="py-4 px-4">Email</th>
                <th className="py-4 px-4">Phone</th>
                <th className="py-4 px-4">Role</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Registered On</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#E85D88]" />
                      <span className="text-sm">Loading customer data...</span>
                    </div>
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No customers found</p>
                      <p className="text-xs text-slate-400">
                        {searchTerm || selectedStatus !== 'ALL'
                          ? 'Try adjusting your search query or status filter.'
                          : 'No registered customer accounts yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                usersList.map((user) => (
                  <tr
                    key={user._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-4 px-4 font-mono text-xs text-slate-500">
                      {user._id.slice(-8).toUpperCase()}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-rose-50 text-[#E85D88] flex items-center justify-center font-bold text-xs shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      <span className="break-all">{user.email}</span>
                    </td>
                    <td className="py-4 px-4 text-slate-600">{user.phone ?? '—'}</td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-0.5 text-xs rounded-full bg-rose-50 text-[#E85D88] font-medium border border-rose-200/60">
                        {user.role ?? 'USER'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {user.status === 'active' ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-600 text-xs">{formatDate(user.createdAt)}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user._id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#E85D88] hover:bg-rose-50 transition"
                          title="View Customer Details"
                        >
                          <Eye className="w-4 h-4 text-[#E85D88]" />
                        </button>

                        {/* Toggle Status Button */}
                        <button
                          type="button"
                          onClick={() => setConfirmUser(user)}
                          className={`p-1.5 rounded-lg transition ${
                            user.status === 'active'
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={user.status === 'active' ? 'Block Customer' : 'Unblock Customer'}
                        >
                          {user.status === 'active' ? (
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Shared Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <Pagination
            currentPage={currentPage}
            totalItems={totalUsers}
            pageSize={itemsPerPage}
            onPageChange={setCurrentPage}
            itemLabel="customers"
          />
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
