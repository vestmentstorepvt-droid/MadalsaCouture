

import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  title?: string;
  data: T[];
  columns: Column<T>[];
  searchableKey?: keyof T;
  searchPlaceholder?: string;
  pageSize?: number;
  headerAction?: React.ReactNode;
  footerAction?: React.ReactNode;
  className?: string;
  emptyText?: string;
}

// Fixed function generic signature: Record<string, unknown> replaces Record<string, any>
export function DataTable<T extends Record<string, unknown>>({
  title,
  data,
  columns,
  searchableKey,
  searchPlaceholder = 'Search records...',
  pageSize = 5,
  headerAction,
  className = '',
  emptyText = 'No records found.',
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Search Filter Logic
  const filteredData = useMemo(() => {
    if (!searchTerm || !searchableKey) return data;
    return data.filter((item) => {
      const val = item[searchableKey];
      return String(val ?? '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    });
  }, [data, searchTerm, searchableKey]);

  // 2. Type-Safe Sorting Logic
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn] as string | number;
      const bVal = b[sortColumn] as string | number;

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // 3. Pagination Logic
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm transition-all duration-200 ${className}`}
    >
      {/* Table Top Controls */}
      {(title || searchableKey || headerAction) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          {title && (
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              {title}
            </h2>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {searchableKey && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ink focus:bg-white transition"
                />
              </div>
            )}
            {headerAction}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 text-slate-400 text-xs font-medium">
              {columns.map((col, index) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 ${
                    index === 0 ? 'rounded-l-xl' : ''
                  } ${index === columns.length - 1 ? 'rounded-r-xl' : ''} ${
                    col.className || ''
                  }`}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1.5 font-semibold text-slate-500 hover:text-slate-800 transition"
                    >
                      {col.header}
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </button>
                  ) : (
                    <span>{col.header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100/80 text-xs font-medium text-slate-700">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={(row.id as string) || rowIndex}
                  className="hover:bg-slate-50/50 transition-colors duration-150"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3.5 px-4 ${col.className || ''}`}
                    >
                      {col.render
                        ? col.render(row)
                        : (row[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-slate-400 font-medium"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Page <strong className="text-slate-700">{currentPage}</strong> of{' '}
            <strong className="text-slate-700">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}