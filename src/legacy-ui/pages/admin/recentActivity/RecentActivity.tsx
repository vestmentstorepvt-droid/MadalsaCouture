import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  FileText,
  ShoppingBag,
  User,
} from 'lucide-react';
import { StatsCard } from '../../../components/ui/cards/StatsCards';
import { SearchBar } from '../../../components/ui/search/SearchBar';
import { Pagination } from '../../../components/ui/pagination/Pagination';
import { useGetAuditLogsQuery, type AuditLog } from '../../../services/recentActivityApi';

const PAGE_SIZE = 8;

/** Extract a display name from the polymorphic `performedBy` field. */
const getPerformedBy = (performedBy: AuditLog['performedBy']): string => {
  if (typeof performedBy === 'string') return performedBy;
  return performedBy?.name ?? performedBy?.email ?? '—';
};

/** Format an ISO date string to a readable label. */
const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const RecentActivity: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading } = useGetAuditLogsQuery(
    { page: currentPage, limit: PAGE_SIZE },
    { refetchOnMountOrArgChange: true }
  );

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;

  // Derive simple stats from the current page of logs
  const stats = useMemo(() => {
    const total = pagination?.total ?? logs.length;
    const orderLogs = logs.filter((l) => l.entity?.toLowerCase().includes('order'));
    const userLogs = logs.filter((l) => l.entity?.toLowerCase().includes('user'));
    const completedLogs = logs.filter((l) => l.action?.toLowerCase().includes('complet'));

    return [
      {
        title: 'Total Logs',
        value: String(total),
        changePercentage: 0,
        changeText: 'all time',
        icon: FileText,
        iconBgColor: 'bg-rose-50',
        iconColor: 'text-[#E85D88]',
      },
      {
        title: 'Order Events',
        value: String(orderLogs.length),
        changePercentage: 0,
        changeText: 'this page',
        icon: ShoppingBag,
        iconBgColor: 'bg-blue-50',
        iconColor: 'text-blue-500',
      },
      {
        title: 'User Events',
        value: String(userLogs.length),
        changePercentage: 0,
        changeText: 'this page',
        icon: User,
        iconBgColor: 'bg-amber-50',
        iconColor: 'text-amber-500',
      },
      {
        title: 'Completed',
        value: String(completedLogs.length),
        changePercentage: 0,
        changeText: 'this page',
        icon: CheckCircle2,
        iconBgColor: 'bg-emerald-50',
        iconColor: 'text-emerald-500',
      },
      {
        title: 'Current Page',
        value: String(pagination?.page ?? currentPage),
        changePercentage: 0,
        changeText: `of ${pagination?.totalPages ?? 1}`,
        icon: Activity,
        iconBgColor: 'bg-purple-50',
        iconColor: 'text-purple-500',
      },
    ];
  }, [logs, pagination, currentPage]);

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter(
      (log) =>
        log.action?.toLowerCase().includes(query) ||
        log.entity?.toLowerCase().includes(query) ||
        getPerformedBy(log.performedBy).toLowerCase().includes(query),
    );
  }, [logs, searchTerm]);

  const totalItems = pagination?.total ?? filteredLogs.length;

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Recent Activity</h2>
        <p className="mt-1 text-sm text-slate-500">
          Track all audit log events and administrative actions in real-time.
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white"
              />
            ))
          : stats.map((stat) => (
              <StatsCard
                key={stat.title}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                changePercentage={stat.changePercentage}
                changeText={stat.changeText}
                iconBgColor={stat.iconBgColor}
                iconColor={stat.iconColor}
              />
            ))}
      </div>

      {/* Search bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="w-full md:max-w-md">
          <SearchBar
            placeholder="Search by action, entity or user..."
            onSearch={(val) => {
              setSearchTerm(val);
              setCurrentPage(1);
            }}
            value={searchTerm}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Entity ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Performed By
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date &amp; Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={5} className="px-4 py-8">
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log._id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-4 text-sm font-medium text-[#E85D88]">
                    {log.action}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700 capitalize">
                    {log.entity}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500 font-mono">
                    {log.entityId ?? '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    {getPerformedBy(log.performedBy)}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {formatDate(log.createdAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  No audit log entries match the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
        <Pagination
          totalItems={totalItems}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => {
            setCurrentPage(page);
          }}
          showPageSizeSelector={false}
          itemLabel="activities"
        />
      </div>
    </div>
  );
};

export default RecentActivity;
