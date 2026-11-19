import React, { useState } from 'react';
import { Pagination } from '../../components/ui/pagination/Pagination';
import { useGetAuditLogsQuery } from '../../services/auditLogApi';
import type { AuditLog } from '../../services/auditLogApi';

const formatDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatPerformedBy = (value: AuditLog['performedBy']): string => {
  if (!value) return '—';
  if (typeof value === 'object' && value !== null) return value.name || '—';
  if (typeof value === 'string') return value;
  return '—';
};

const formatEntityId = (id?: string): string => {
  if (!id) return '—';
  if (id.length > 12) return id.slice(-8);
  return id;
};

const isLongId = (id?: string): boolean => !!id && id.length > 12;

export const AuditLogs: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);

  const { data, isLoading, isError, refetch } = useGetAuditLogsQuery({
    page: currentPage,
    limit: pageSize,
  });

  const logs: AuditLog[] = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;


  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Read-only record of all administrative actions.</p>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4">
            <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full table-auto text-left border-collapse">
                <thead>
                  <tr className="text-sm text-slate-500 border-b border-slate-100">
                    <th className="py-3 px-4 text-left">Action</th>
                    <th className="py-3 px-4 text-left">Entity</th>
                    <th className="py-3 px-4 text-left">Entity ID</th>
                    <th className="py-3 px-4 text-left">Performed By</th>
                    <th className="py-3 px-4 text-left min-w-[160px]">Date &amp; Time</th>
                  </tr>
                </thead>

                <tbody className="text-sm text-slate-700">
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Loading...</td>
                    </tr>
                  )}

                  {!isLoading && isError && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-rose-500">
                        Failed to load audit logs.{' '}
                        <button
                          type="button"
                          onClick={() => refetch()}
                          className="ml-2 underline text-accent hover:opacity-80"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  )}

                  {!isLoading && !isError && logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">No audit logs found.</td>
                    </tr>
                  )}

                  {!isLoading && !isError && logs.map((log) => (
                    <tr key={log._id} className="border-b border-slate-100 hover:bg-slate-50 align-middle">
                      <td className="py-3 px-4 align-middle">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-pink-50 text-accent text-xs font-semibold border border-pink-100">
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-4 align-middle">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                          {log.entity}
                        </span>
                      </td>

                      <td className="py-3 px-4 align-middle">
                        {log.entityId ? (
                          <span className={isLongId(log.entityId) ? 'font-mono text-xs text-slate-500' : 'text-slate-700'}>
                            {formatEntityId(log.entityId)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 align-middle">
                        {formatPerformedBy(log.performedBy)}
                      </td>

                      <td className="py-3 px-4 align-middle text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer / Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white">
            <Pagination
              currentPage={currentPage}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              showPageSizeSelector={false}
              itemLabel="entries"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
