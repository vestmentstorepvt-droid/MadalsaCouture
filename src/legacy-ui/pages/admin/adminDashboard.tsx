import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Users, Package, IndianRupee, TrendingDown } from 'lucide-react';
import { StatsCard } from '../../components/ui/cards/StatsCards';
import { SalesOverviewChart, type SalesDataItem } from '../../components/ui/charts/SalesOverviewChart';
import { OrderStatusChart, type OrderStatusItem } from '../../components/ui/charts/OrderStatusChart';
import { DataTable, type Column } from '../../components/ui/table/DataTable';
import { FaRegHandSpock } from 'react-icons/fa';
import {
  useGetRecentOrdersQuery,
  useGetDashboardKpisQuery,
  useGetSalesReportQuery,
  type RecentOrderPayload,
  type SalesReportParams,
} from '../../services/adminOrdersApi';

// ─── Status colour map ────────────────────────────────────────────────────────
const STATUS_COLOR_MAP: Record<string, string> = {
  Delivered:     '#E85D88',
  OutForDelivery:'#A070D6',
  Shipped:       '#6366F1',
  Processing:    '#F9A865',
  Pending:       '#F59E0B',
  Paid:          '#10B981',
  Cancelled:     '#52B2E6',
  Refunded:      '#94A3B8',
};
const STATUS_COLOR_FALLBACKS = ['#E85D88', '#A070D6', '#F9A865', '#52B2E6', '#64748B'];

// ─── Build ?from=&to=&groupBy= params from the time-range dropdown ────────────
function buildSalesParams(range: string): SalesReportParams {
  const now   = new Date();
  const pad   = (n: number) => String(n).padStart(2, '0');
  const fmt   = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const to    = fmt(now);

  if (range === 'Last Month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last  = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(first), to: fmt(last), groupBy: 'day' };
  }
  if (range === 'This Year') {
    const first = new Date(now.getFullYear(), 0, 1);
    return { from: fmt(first), to, groupBy: 'month' };
  }
  // Default: This Month
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(first), to, groupBy: 'day' };
}

// ─── Derived row type for the recent-orders table ────────────────────────────
interface RecentOrderRow extends Record<string, unknown> {
  id:               string;
  orderId:          string;
  customerName:     string;
  itemsCount:       number;
  amount:           number;
  status:           string;
  date:             string;
  orderDetailsPath: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

const getCustomerName = (order: RecentOrderPayload): string => {
  if (order.userId && typeof order.userId === 'object' && order.userId.name) {
    return order.userId.name;
  }
  return order.guestEmail || 'Guest';
};

const mapOrder = (o: RecentOrderPayload): RecentOrderRow => ({
  id:               o._id,
  orderId:          o.orderNumber,
  customerName:     getCustomerName(o),
  itemsCount:       Array.isArray(o.items) ? o.items.length : 0,
  amount:           o.total,
  status:           o.status,
  date:             formatDate(o.createdAt),
  orderDetailsPath: `/admin/orders/${o._id}`,
});

// ─── Skeleton / Error UI helpers ──────────────────────────────────────────────
const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

const StatsCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
    <div className="flex items-center justify-between">
      <SkeletonBlock className="w-11 h-11 rounded-xl" />
      <SkeletonBlock className="w-24 h-4" />
    </div>
    <SkeletonBlock className="w-32 h-7" />
    <SkeletonBlock className="w-20 h-3" />
  </div>
);

const TableSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3 ${className}`}>
    <SkeletonBlock className="w-40 h-5 mb-4" />
    {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="w-full h-8" />)}
  </div>
);

const ErrorState: React.FC<{ message?: string; onRetry?: () => void; className?: string }> = ({
  message = 'Failed to load data.',
  onRetry,
  className = '',
}) => (
  <div className={`bg-rose-50 border border-rose-200 rounded-2xl p-6 flex flex-col items-center gap-3 text-center ${className}`}>
    <p className="text-rose-700 font-semibold text-sm">{message}</p>
    {onRetry && (
      <button type="button" onClick={onRetry}
        className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-xl transition">
        Retry
      </button>
    )}
  </div>
);

// ─── TopProductRow type for the top-selling table ────────────────────────────
interface TopProductRow extends Record<string, unknown> {
  name:    string;
  revenue: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRange, setSelectedRange] = useState('This Month');

  // 1. Dashboard KPIs — GET /api/v1/admin/dashboard
  const {
    data: kpis,
    isLoading: isLoadingKpis,
    isError: isErrorKpis,
    refetch: refetchKpis,
  } = useGetDashboardKpisQuery();

  // 2. Sales report — GET /api/v1/admin/reports/sales?from=&to=&groupBy=
  //    Used to populate the time-range-filtered sales chart
  const salesParams = buildSalesParams(selectedRange);
  const {
    data: salesRows = [],
    isLoading: isLoadingSales,
    isError: isErrorSales,
    refetch: refetchSales,
  } = useGetSalesReportQuery(salesParams);

  // 3. Recent orders — GET /api/v1/admin/orders?limit=5&page=1
  const {
    data: ordersRaw = [],
    isLoading: isLoadingOrders,
    isError: isErrorOrders,
  } = useGetRecentOrdersQuery();

  // ── Derived values ───────────────────────────────────────────────────────

  // Stats cards (from KPIs)
  const statsCards = kpis
    ? [
        {
          title: 'Total Orders',
          value: kpis.totalOrders.toLocaleString('en-IN'),
          icon: ShoppingBag,
          changePercentage: 0,
          iconBgColor: 'bg-rose-50',
          iconColor: 'text-[#E85D88]',
        },
        {
          title: "Today's Revenue",
          value: `₹${kpis.todayRevenue.toLocaleString('en-IN')}`,
          icon: IndianRupee,
          changePercentage: 0,
          iconBgColor: 'bg-emerald-50',
          iconColor: 'text-emerald-500',
        },
        {
          title: 'Total Customers',
          value: kpis.totalCustomers.toLocaleString('en-IN'),
          icon: Users,
          changePercentage: 0,
          iconBgColor: 'bg-pink-50',
          iconColor: 'text-pink-500',
        },
        {
          title: 'Total Products',
          value: kpis.totalProducts.toLocaleString('en-IN'),
          icon: Package,
          changePercentage: 0,
          iconBgColor: 'bg-rose-50',
          iconColor: 'text-[#E85D88]',
        },
        {
          title: 'Low Stock Items',
          value: kpis.lowStockCount.toLocaleString('en-IN'),
          icon: TrendingDown,
          changePercentage: 0,
          iconBgColor: 'bg-amber-50',
          iconColor: 'text-amber-500',
        },
        {
          title: 'New Customers (7d)',
          value: kpis.newCustomers.toLocaleString('en-IN'),
          icon: Users,
          changePercentage: 0,
          iconBgColor: 'bg-violet-50',
          iconColor: 'text-violet-500',
        },
      ]
    : [];

  // Sales overview chart data — comes from the time-range report
  // salesRows: [{period, revenue, orderCount, aov}]
  const salesChartData: SalesDataItem[] = salesRows.map((row) => ({
    date:  row.period,
    sales: row.revenue,
  }));

  // Order status donut chart — comes from KPI orderStatusBreakdown
  const orderStatusData: OrderStatusItem[] = (kpis?.orderStatusBreakdown ?? []).map(
    (item, idx) => ({
      name:  item.status,
      value: item.count,
      color: STATUS_COLOR_MAP[item.status] ?? STATUS_COLOR_FALLBACKS[idx % STATUS_COLOR_FALLBACKS.length],
    })
  );

  // Recent orders rows
  const recentOrders = ordersRaw.map(mapOrder);

  // Top products — comes directly from KPI topProducts [{name, revenue}]
  const topProducts: TopProductRow[] = (kpis?.topProducts ?? []).map((p) => ({
    name:    p.name,
    revenue: p.revenue,
  }));

  // ── Table column definitions ─────────────────────────────────────────────

  const recentOrdersColumns: Column<RecentOrderRow>[] = [
    {
      key: 'orderId',
      header: 'Order ID',
      render: (row) => (
        <button type="button"
          className="font-bold text-slate-800 hover:text-[#E85D88] transition"
          onClick={() => navigate(row.orderDetailsPath)}>
          {row.orderId}
        </button>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-100 text-[11px] font-semibold text-slate-700 flex items-center justify-center">
            {getInitials(row.customerName)}
          </div>
          <span className="font-semibold text-slate-800">{row.customerName}</span>
        </div>
      ),
    },
    {
      key: 'itemsCount',
      header: 'Items',
      render: (row) => (
        <span className="text-slate-600">{row.itemsCount} {row.itemsCount === 1 ? 'Item' : 'Items'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <span className="font-bold text-slate-800">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const styles: Record<string, string> = {
          Delivered:      'bg-emerald-50 text-emerald-600 border border-emerald-100',
          OutForDelivery: 'bg-violet-50 text-violet-600 border border-violet-100',
          Shipped:        'bg-indigo-50 text-indigo-600 border border-indigo-100',
          Processing:     'bg-amber-50 text-amber-600 border border-amber-100',
          Paid:           'bg-emerald-50 text-emerald-700 border border-emerald-100',
          Pending:        'bg-yellow-50 text-yellow-600 border border-yellow-100',
          Cancelled:      'bg-rose-50 text-rose-500 border border-rose-100',
          Refunded:       'bg-slate-100 text-slate-600 border border-slate-200',
        };
        return (
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${styles[row.status] ?? 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
            {row.status}
          </span>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="text-slate-500">{row.date}</span>,
    },
  ];

  const topProductsColumns: Column<TopProductRow>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
            <Package className="w-4 h-4 text-[#E85D88]" />
          </div>
          <span className="font-semibold text-slate-800">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      render: (row) => (
        <span className="font-bold text-[#E85D88] text-right block">
          {formatCurrency(row.revenue)}
        </span>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-[#FAFAFC] min-h-screen space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Welcome back,{' '}
            <span className="text-[#E85D88] flex items-center gap-1.5">
              Admin
              <FaRegHandSpock className="inline-block w-6 h-6 text-[#E85D88]" />
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Here's what's happening with your store today.</p>
        </div>
        <select
          value={selectedRange}
          onChange={(e) => setSelectedRange(e.target.value)}
          className="bg-white border border-slate-200 text-slate-600 text-sm rounded-xl px-3 py-2 outline-none"
        >
          <option>This Month</option>
          <option>Last Month</option>
          <option>This Year</option>
        </select>
      </div>

      {/* Stats Cards — 6 cards from KPIs */}
      {isLoadingKpis ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map((i) => <StatsCardSkeleton key={i} />)}
        </div>
      ) : isErrorKpis ? (
        <ErrorState message="Failed to load dashboard KPIs." onRetry={refetchKpis} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statsCards.map((stat, idx) => (
            <StatsCard
              key={idx}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              changePercentage={stat.changePercentage}
              iconBgColor={stat.iconBgColor}
              iconColor={stat.iconColor}
            />
          ))}
        </div>
      )}

      {/* Charts: Sales Overview + Order Status Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col min-h-[350px]">
          {isLoadingSales ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-full w-full flex items-center justify-center">
              <SkeletonBlock className="w-full h-56" />
            </div>
          ) : isErrorSales ? (
            <ErrorState message="Failed to load sales data." onRetry={refetchSales} className="h-full w-full flex-1" />
          ) : (
            <SalesOverviewChart title="Sales Overview" data={salesChartData} className="h-full w-full flex-1" />
          )}
        </div>
        <div className="lg:col-span-4 flex flex-col min-h-[350px]">
          {isLoadingKpis ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-full w-full flex items-center justify-center">
              <SkeletonBlock className="w-full h-56" />
            </div>
          ) : (
            <OrderStatusChart title="Order Status" data={orderStatusData} className="h-full w-full flex-1" />
          )}
        </div>
      </div>

      {/* Tables: Recent Orders + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Recent Orders */}
        <div className="lg:col-span-8">
          {isLoadingOrders ? (
            <TableSkeleton />
          ) : isErrorOrders ? (
            <ErrorState message="Failed to load recent orders." />
          ) : (
            <DataTable
              title="Recent Orders"
              data={recentOrders as unknown as Record<string, unknown>[]}
              columns={recentOrdersColumns as unknown as Column<Record<string, unknown>>[]}
              pageSize={5}
              headerAction={
                <button type="button" onClick={() => navigate('/admin/orders')}
                  className="text-xs font-semibold text-[#E85D88] bg-[#FFF0F5] hover:bg-[#FFE4EE] px-4 py-2 rounded-xl transition">
                  View All
                </button>
              }
              emptyText="No recent orders found."
            />
          )}
        </div>

        {/* Top Products (from KPI topProducts) */}
        <div className="lg:col-span-4">
          {isLoadingKpis ? (
            <TableSkeleton />
          ) : isErrorKpis ? (
            <ErrorState message="Failed to load top products." onRetry={refetchKpis} />
          ) : (
            <DataTable
              title="Top Products by Revenue"
              data={topProducts}
              columns={topProductsColumns}
              pageSize={5}
              emptyText="No product revenue data yet."
            />
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
