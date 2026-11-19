
import React from 'react';
import { type LucideIcon, MoreVertical, TrendingUp, TrendingDown } from 'lucide-react';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  changePercentage: number;
  changeText?: string;
  iconBgColor?: string;
  iconColor?: string;
  onMoreClick?: () => void;
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  changePercentage,
  changeText,
  iconBgColor = 'bg-accent-soft',
  iconColor = 'text-accent',
  onMoreClick,
  className = '',
}) => {
  const hasTrend = changePercentage !== 0;
  const isPositive = changePercentage > 0;
  const caption = changeText ?? (hasTrend ? 'from last month' : '');

  return (
    <div
      className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between mb-3">
        {/* Left Icon Container */}
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBgColor}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>

        {/* Right Section: Title & Optional More Menu */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-500">{title}</span>
          {onMoreClick && (
            <button
              onClick={onMoreClick}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="my-1">
        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
          {value}
        </h3>
      </div>

      {/* Bottom Percentage Trend Indicator (hidden when there is no real trend) */}
      {(hasTrend || caption) && (
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          {hasTrend && (
            <div
              className={`flex items-center gap-0.5 font-semibold ${
                isPositive ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {isPositive ? '+' : ''}
                {changePercentage}%
              </span>
            </div>
          )}
          {caption && <span className="text-slate-400 font-normal">{caption}</span>}
        </div>
      )}
    </div>
  );
};