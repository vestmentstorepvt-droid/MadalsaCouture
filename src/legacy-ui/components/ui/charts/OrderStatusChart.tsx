

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface OrderStatusItem {
  name: string;
  value: number;
  color: string;
}

export interface OrderStatusChartProps {
  title?: string;
  data?: OrderStatusItem[];
  centerLabel?: string;
  className?: string;
}

const EMPTY_ORDER_DATA: OrderStatusItem[] = [];

export const OrderStatusChart: React.FC<OrderStatusChartProps> = ({
  title = 'Order Status',
  data = EMPTY_ORDER_DATA,
  centerLabel = 'Total',
  className = '',
}) => {
  // Calculate total dynamically for percentage calculations and center text
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  // Format PascalCase status name to readable format
  const formatStatusName = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').trim();
  };

  return (
    <div
      className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm transition-all duration-200 ${className}`}
    >
      {/* Title Header */}
      <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">
        {title}
      </h2>

      {/* Main Grid: Chart on Left, Custom Legend on Right */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Left Side: Donut Chart with Center Text Overlay */}
        <div className="sm:col-span-6 relative flex items-center justify-center h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={0}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as OrderStatusItem;
                    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                      <div className="bg-white border border-slate-100 rounded-xl shadow-md p-2.5 text-center text-xs">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-700">
                          {item.name}:
                        </span>{' '}
                        <span className="font-bold text-slate-900">
                          {item.value} ({percentage}%)
                        </span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Absolute Center Content inside Donut Ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {total.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-400 mt-0.5">
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Right Side: Custom Styled Legend List */}
        <div className="sm:col-span-6 space-y-3.5 pl-2">
          {data.map((item) => {
            const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs font-medium"
              >
                {/* Left side dot + Status name */}
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 font-semibold truncate" title={formatStatusName(item.name)}>
                    {formatStatusName(item.name)}
                  </span>
                </div>

                {/* Right side Count + Percentage display */}
                <div className="text-slate-500 whitespace-nowrap flex-shrink-0">
                  <span className="font-bold text-slate-800 mr-1">
                    {item.value.toLocaleString()}
                  </span>
                  <span className="text-slate-400 font-normal">
                    ({percentage}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};