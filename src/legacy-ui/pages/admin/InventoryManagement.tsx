import React, { useState } from 'react';
import {
  Boxes,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Layers,
  Plus,
  Minus,
} from 'lucide-react';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import { AppDropdown } from '../../components/ui/dropdown/AppDropdown';
import { AppButton } from '../../components/ui/button/AppButton';
import { Pagination } from '../../components/ui/pagination/Pagination';
import {
  useGetInventoryQuery,
  useAdjustInventoryMutation,
  useGetInventoryLogQuery,
} from '../../services/inventoryApi';
import type {
  InventoryItem,
  InventoryReasonCode,
} from '../../services/inventoryApi';

// ── Exact Reason Code Options Matching Backend ────────────────────────────────
const REASON_CODE_OPTIONS = [
  { label: 'Purchase / Restock Inflow (+)', value: 'purchase' },
  { label: 'Customer Return Restock (+)', value: 'return' },
  { label: 'Physical Count Adjustment (+/-)', value: 'adjustment' },
  { label: 'Damaged / Defective Stock (-)', value: 'damaged' },
  { label: 'Lost / Inventory Shrinkage (-)', value: 'loss' },
  { label: 'Found / Recovered Stock (+)', value: 'found' },
];

// The API only returns variants whose available stock is at or below the threshold,
// so "all" is expressed as a threshold no real stock level can exceed.
const ALL_STOCK_THRESHOLD = 1_000_000;

const THRESHOLD_OPTIONS = [
  { label: 'All stock levels', value: String(ALL_STOCK_THRESHOLD) },
  { label: 'Threshold: ≤ 5 units', value: '5' },
  { label: 'Threshold: ≤ 10 units', value: '10' },
  { label: 'Threshold: ≤ 25 units', value: '25' },
  { label: 'Threshold: ≤ 50 units', value: '50' },
];

const STATUS_FILTER_OPTIONS = [
  { label: 'All Inventory Items', value: 'ALL' },
  { label: 'Out of Stock (0 units)', value: 'OUT_OF_STOCK' },
  { label: 'Critically Low (1-3 units)', value: 'CRITICAL' },
  { label: 'Low Stock (4-10 units)', value: 'LOW' },
  { label: 'Adequate (> 10 units)', value: 'OK' },
];

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

// ── Stock Badge Helper ────────────────────────────────────────────────────────
function stockBadge(stock: number, reserved = 0) {
  const available = Math.max(0, stock - reserved);
  if (stock === 0) {
    return {
      label: 'Out of Stock',
      cls: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  if (available <= 3) {
    return {
      label: 'Critically Low',
      cls: 'bg-rose-50 text-rose-600 border-rose-100',
    };
  }
  if (available <= 10) {
    return {
      label: 'Low Stock',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: 'In Stock',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
}

// ── Adjust Stock Modal ────────────────────────────────────────────────────────
interface AdjustStockModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const AdjustStockModal: React.FC<AdjustStockModalProps> = (props) =>
  props.item ? <AdjustStockModalContent {...props} item={props.item} /> : null;

const AdjustStockModalContent: React.FC<AdjustStockModalProps & { item: InventoryItem }> = ({
  item,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [deltaMode, setDeltaMode] = useState<'add' | 'remove'>('add');
  const [deltaValue, setDeltaValue] = useState<string>('5');
  const [reasonCode, setReasonCode] = useState<InventoryReasonCode>('purchase');
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [adjustInventory, { isLoading }] = useAdjustInventoryMutation();

  const numDelta = Number(deltaValue) || 0;
  const signedDelta = deltaMode === 'add' ? Math.abs(numDelta) : -Math.abs(numDelta);
  const projectedStock = item.stock + signedDelta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numDelta <= 0 || !Number.isInteger(numDelta)) {
      setError('Please enter a valid whole number greater than 0');
      return;
    }

    if (projectedStock < 0) {
      setError(`Cannot remove ${Math.abs(signedDelta)} units: only ${item.stock} available.`);
      return;
    }

    try {
      await adjustInventory({
        variantId: item.variantId,
        delta: signedDelta,
        reasonCode,
        note: note.trim() || undefined,
      }).unwrap();
      showToast(
        `Adjusted ${item.productName}: ${signedDelta > 0 ? `+${signedDelta}` : signedDelta} units (${reasonCode})`,
        'success'
      );
      onSuccess();
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: { message?: string }; message?: string } };
      setError(
        apiErr?.data?.error?.message ||
          apiErr?.data?.message ||
          'Failed to adjust stock. Please try again.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Adjust Inventory Stock</h2>
            <p className="text-xs text-slate-500">
              {item.productName} ({[item.size, item.color].filter(Boolean).join(' · ')})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs Projected Stock Preview Card */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                Current Stock
              </span>
              <span className="text-xl font-bold text-slate-800">{item.stock}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Adjustment</span>
              <span
                className={`text-xl font-bold font-mono ${
                  signedDelta > 0
                    ? 'text-emerald-600'
                    : signedDelta < 0
                    ? 'text-rose-600'
                    : 'text-slate-400'
                }`}
              >
                {signedDelta > 0 ? `+${signedDelta}` : signedDelta}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                New Projected Stock
              </span>
              <span
                className={`text-xl font-bold ${
                  projectedStock < 0 ? 'text-rose-600' : 'text-[#E85D88]'
                }`}
              >
                {Math.max(0, projectedStock)}
              </span>
            </div>
          </div>

          {/* Adjustment Mode & Quantity */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Adjustment Operation
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setDeltaMode('add');
                  if (['damaged', 'loss'].includes(reasonCode)) setReasonCode('purchase');
                }}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  deltaMode === 'add'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Increase Stock (+ Add)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeltaMode('remove');
                  if (['purchase', 'return'].includes(reasonCode)) setReasonCode('damaged');
                }}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  deltaMode === 'remove'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Minus className="w-3.5 h-3.5" /> Decrease Stock (- Remove)
              </button>
            </div>

            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Quantity of Units *
            </label>
            <input
              type="number"
              min={1}
              value={deltaValue}
              onChange={(e) => setDeltaValue(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
              placeholder="e.g. 10"
              required
            />
          </div>

          {/* Reason Code Dropdown */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Audit Reason Code *
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as InventoryReasonCode)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] bg-white"
            >
              {REASON_CODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Audit Note */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Audit Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received PO #5092 from vendor / Fabric flaw check"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <AppButton type="submit" variant="primary" size="md" isLoading={isLoading}>
              Confirm Stock Update
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Inventory Audit Log Modal ─────────────────────────────────────────────────
interface InventoryLogModalProps {
  item: InventoryItem | null;
  onClose: () => void;
}

const InventoryLogModal: React.FC<InventoryLogModalProps> = ({ item, onClose }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const { data: logResp, isLoading } = useGetInventoryLogQuery(
    { variantId: item?.variantId ?? '', page: currentPage, limit: pageSize },
    { skip: !item }
  );

  if (!item) return null;

  const logs = logResp?.data ?? [];
  const pagination = logResp?.pagination;
  const total = pagination?.total ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#E85D88]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Inventory Audit History</h2>
              <p className="text-xs text-slate-500">
                {item.productName} ({[item.size, item.color].filter(Boolean).join(' · ')})
              </p>
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

        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <p className="text-center py-8 text-xs text-slate-400">Loading audit history...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-10">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No manual adjustments logged yet.</p>
              <p className="text-[11px] text-slate-400">Stock updates will automatically generate an audit entry.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log._id}
                  className="flex items-start justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center font-bold px-2 py-0.5 rounded-md font-mono ${
                          log.delta > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.delta > 0 ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                      </span>
                      <span className="font-semibold text-slate-800 uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200">
                        {log.reasonCode}
                      </span>
                    </div>

                    {log.note && <p className="text-slate-600">{log.note}</p>}
                    {log.actorEmail && (
                      <p className="text-[11px] text-slate-400">By: {log.actorEmail}</p>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 shrink-0">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Pagination */}
        {total > pageSize && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
            <Pagination
              currentPage={currentPage}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemLabel="variants"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const InventoryManagement: React.FC = () => {
  const [threshold, setThreshold] = useState<number>(ALL_STOCK_THRESHOLD);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [logTarget, setLogTarget] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const { data: inventory = [], isLoading, isFetching, refetch } = useGetInventoryQuery({
    threshold,
  });

  const allItems: InventoryItem[] = inventory;

  // Filter items client-side by search and status
  const filteredItems = allItems.filter((item) => {
    const matchesSearch =
      !searchTerm.trim() ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.color?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.size?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'OUT_OF_STOCK') return item.stock === 0;
    if (statusFilter === 'CRITICAL') return item.stock > 0 && item.stock <= 3;
    if (statusFilter === 'LOW') return item.stock > 3 && item.stock <= 10;
    if (statusFilter === 'OK') return item.stock > 10;

    return true;
  });

  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Metrics
  const zeroStockCount = allItems.filter((i) => i.stock === 0).length;
  const criticalCount = allItems.filter((i) => i.stock > 0 && i.stock <= 3).length;
  const totalUnits = allItems.reduce((acc, i) => acc + i.stock, 0);
  const totalReserved = allItems.reduce((acc, i) => acc + (i.reservedStock || 0), 0);

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800 space-y-6">
      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Adjust Modal */}
      <AdjustStockModal
        item={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onSuccess={() => {
          setAdjustTarget(null);
          refetch();
        }}
        showToast={(msg, type) => setToast({ message: msg, type: type || 'success' })}
      />

      {/* Log Modal */}
      <InventoryLogModal key={logTarget?.variantId ?? 'none'} item={logTarget} onClose={() => setLogTarget(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor low-stock alerts, adjust variant inventory, and track stock audit logs.
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
          title="Out of Stock (0 units)"
          value={zeroStockCount.toLocaleString()}
          changePercentage={0}
          changeText="variants depleted"
          icon={AlertTriangle}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
        <StatsCard
          title="Critically Low (≤ 3)"
          value={criticalCount.toLocaleString()}
          changePercentage={0}
          changeText="near stockout"
          icon={TrendingDown}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatsCard
          title={threshold >= ALL_STOCK_THRESHOLD ? 'Total Physical Stock' : 'Stock in Selected Range'}
          value={totalUnits.toLocaleString()}
          changePercentage={0}
          changeText="units in warehouse"
          icon={Boxes}
          iconBgColor="bg-sky-50"
          iconColor="text-sky-600"
        />
        <StatsCard
          title="Reserved Units"
          value={totalReserved.toLocaleString()}
          changePercentage={0}
          changeText="held for pending orders"
          icon={Layers}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search product, SKU, color..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E85D88]/20 focus:border-[#E85D88] transition"
            />
          </div>

          {/* Threshold Dropdown */}
          <div className="w-full sm:w-60">
            <AppDropdown
              options={THRESHOLD_OPTIONS}
              value={String(threshold)}
              onChange={(v) => {
                setThreshold(Number(v));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-full sm:w-48">
            <AppDropdown
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(String(v));
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {(searchTerm || statusFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setCurrentPage(1);
            }}
            className="text-xs text-[#E85D88] hover:underline font-semibold self-end lg:self-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Inventory Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-4">Product Name</th>
                <th className="py-4 px-4">Variant Attributes</th>
                <th className="py-4 px-4">SKU</th>
                <th className="py-4 px-4">Physical Stock</th>
                <th className="py-4 px-4">Available</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#E85D88]" />
                      <span className="text-sm">Loading inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-700">No matching inventory items</p>
                      <p className="text-xs text-slate-400">
                        {threshold >= ALL_STOCK_THRESHOLD
                          ? 'No inventory items match your search or filters.'
                          : `All items have more than ${threshold} units, or no items match your search.`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const badge = stockBadge(item.stock, item.reservedStock);
                  const available = Math.max(0, item.stock - (item.reservedStock || 0));

                  return (
                    <tr key={item.variantId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product Name */}
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-900 block">{item.productName}</span>
                      </td>

                      {/* Variant Attributes */}
                      <td className="py-4 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.size && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                              {item.size}
                            </span>
                          )}
                          {item.color && (
                            <span className="px-2 py-0.5 rounded-md bg-pink-50 text-[#E85D88] font-medium">
                              {item.color}
                            </span>
                          )}
                          {item.fabric && <span className="text-slate-400">({item.fabric})</span>}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-4 px-4 font-mono text-xs text-slate-500">
                        {item.sku || '—'}
                      </td>

                      {/* Physical Stock */}
                      <td className="py-4 px-4 font-bold text-slate-900 text-sm">
                        {item.stock} units
                      </td>

                      {/* Available Stock */}
                      <td className="py-4 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{available} units</span>
                        {item.reservedStock ? (
                          <span className="text-[10px] text-purple-600 block">
                            ({item.reservedStock} reserved)
                          </span>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAdjustTarget(item)}
                            className="px-3 py-1.5 rounded-xl bg-pink-50 border border-pink-200 text-[#E85D88] text-xs font-semibold hover:bg-pink-100 transition flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Adjust
                          </button>

                          <button
                            type="button"
                            onClick={() => setLogTarget(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition"
                            title="View Audit Log"
                          >
                            <History className="w-4 h-4 text-purple-600" />
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
            totalItems={filteredItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemLabel="variants"
          />
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
