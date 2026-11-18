import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { useGetAdminExchangesQuery, type AdminExchange } from '../../services/adminExchangesApi';
import { StatsCard } from '../../components/ui/cards/StatsCards';

const STATUS_OPTIONS = [
  { label: 'All Status', value: 'ALL' },
  { label: 'Requested', value: 'ExchangeRequested' },
  { label: 'Approved', value: 'ExchangeApproved' },
  { label: 'Pickup Scheduled', value: 'ExchangePickupScheduled' },
  { label: 'In Transit', value: 'ExchangeInTransit' },
  { label: 'QC Passed', value: 'QCPassed' },
  { label: 'QC Failed', value: 'QCFailed' },
  { label: 'Replacement Shipped', value: 'ReplacementShipped' },
  { label: 'Completed', value: 'ExchangeCompleted' },
  { label: 'Rejected', value: 'ExchangeRejected' },
];

const formatStatus = (status: string) =>
  status.replace(/^Exchange/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

export const ExchangeManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading, isFetching, refetch } = useGetAdminExchangesQuery({});

  const exchanges: AdminExchange[] = data?.exchanges || [];

  const filteredExchanges = exchanges.filter((exc) => {
    if (statusFilter !== 'ALL' && exc.status !== statusFilter) return false;
    if (searchInput) {
      const q = searchInput.toLowerCase();
      // Search by Order number or exchange ID
      const orderMatch = exc.orderId?.orderNumber?.toLowerCase().includes(q) || false;
      const idMatch = exc._id.toLowerCase().includes(q);
      return orderMatch || idMatch;
    }
    return true;
  });

  const getStatusBadge = (status: AdminExchange['status']) => {
    switch (status) {
      case 'ExchangeRequested':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'ExchangeApproved':
      case 'ExchangePickupScheduled':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'ExchangeInTransit':
      case 'ReplacementShipped':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'QCFailed':
      case 'ExchangeRejected':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'QCPassed':
      case 'ExchangeCompleted':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  const pendingCount = exchanges.filter(e => e.status === 'ExchangeRequested').length;
  const completedCount = exchanges.filter(e => e.status === 'ExchangeCompleted').length;

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Exchange Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Review and manage customer returns and exchanges.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-slate-400' : 'text-slate-600'}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="Total Requests"
          value={exchanges.length.toLocaleString()}
          changePercentage={0}
          changeText="Lifetime requests"
          icon={RotateCcw}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-700"
        />
        <StatsCard
          title="Pending Approval"
          value={pendingCount.toLocaleString()}
          changePercentage={0}
          changeText="Needs attention"
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatsCard
          title="Completed"
          value={completedCount.toLocaleString()}
          changePercentage={0}
          changeText="Successfully resolved"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Order ID..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] transition"
            />
          </div>

          <div className="w-full sm:w-48">
            <AppDropdown
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => setStatusFilter(String(v))}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Exchange ID</th>
                <th className="px-6 py-4 font-semibold">Order</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading exchanges...
                  </td>
                </tr>
              ) : filteredExchanges.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                    No exchange requests found.
                  </td>
                </tr>
              ) : (
                filteredExchanges.map((exc) => (
                  <tr key={exc._id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-900 font-semibold">{exc._id.slice(-8)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-700">#{exc.orderId?.orderNumber || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{exc.requestedBy?.name || 'Guest'}</p>
                      <p className="text-xs text-slate-500">{exc.requestedBy?.email || ''}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">
                      {new Date(exc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(exc.status)}`}>
                        {formatStatus(exc.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/admin/exchanges/${exc._id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExchangeManagement;
