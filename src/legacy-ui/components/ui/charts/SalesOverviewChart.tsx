

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export interface SalesDataItem {
  date: string;
  displayDate?: string; // e.g., '1 May', '15 May'
  sales: number;
}

const DEFAULT_SALES_DATA: SalesDataItem[] = [];

export interface SalesOverviewChartProps {
  title?: string;
  data?: SalesDataItem[];
  currencySymbol?: string;
  timeRangeOptions?: string[];
  onTimeRangeChange?: (selectedRange: string) => void;
  className?: string;
}

export const SalesOverviewChart: React.FC<SalesOverviewChartProps> = ({
  title = 'Sales Overview',
  data = DEFAULT_SALES_DATA,
  currencySymbol = '₹',
  timeRangeOptions = ['This Month', 'Last Month', 'This Year'],
  onTimeRangeChange,
  className = '',
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRangeOptions[0]);

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedRange(value);
    if (onTimeRangeChange) {
      onTimeRangeChange(value);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm transition-all duration-200 ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          {title}
        </h2>

        {/* Dropdown Timeframe Filter (Only show if callback is provided) */}
        {onTimeRangeChange && timeRangeOptions && timeRangeOptions.length > 0 && (
          <div className="relative">
            <select
              value={selectedRange}
              onChange={handleRangeChange}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-8 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent cursor-pointer shadow-sm transition"
            >
              {timeRangeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              ▼
            </div>
          </div>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div className="w-full h-72">
        {data.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <span className="text-sm font-medium">No sales data available for this period.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 25, right: 10, left: 10, bottom: 0 }}
            >
              {/* Smooth Linear Gradient Fill */}
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c2255c" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#c2255c" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Subtle Horizontal Reference Grid Line */}
              <CartesianGrid
                vertical={false}
                stroke="#F1F5F9"
                strokeDasharray="4 4"
              />

              {/* X-Axis Setup */}
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12 }}
                interval="preserveStartEnd"
                dy={10}
                tickFormatter={(val) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(new Date(val));
                  }
                  if (/^\d{4}-\d{2}$/.test(val)) {
                    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(val + '-01'));
                  }
                  return val;
                }}
              />

              {/* Y-Axis Setup */}
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12 }}
                width={50}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val)}
              />

              {/* Floating Custom Tooltip */}
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0].payload as SalesDataItem;
                    let displayDate = dataPoint.date;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dataPoint.date)) {
                      displayDate = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dataPoint.date));
                    } else if (/^\d{4}-\d{2}$/.test(dataPoint.date)) {
                      displayDate = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(dataPoint.date + '-01'));
                    }

                    return (
                      <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-center min-w-[120px]">
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">
                          {displayDate}
                        </p>
                        <p className="text-sm font-bold text-slate-800">
                          {currencySymbol}
                          {dataPoint.sales.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Curved Area Line Rendering */}
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#c2255c"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorSales)"
                activeDot={{
                  r: 6,
                  fill: '#c2255c',
                  stroke: '#ffffff',
                  strokeWidth: 3,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};