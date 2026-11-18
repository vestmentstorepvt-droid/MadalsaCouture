
import React, { type ButtonHTMLAttributes } from 'react';
import {type LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  isLoading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...rest
}) => {
  // Base structural classes matching theme tokens
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E85D88] focus:ring-offset-2 focus:ring-offset-[#110E1B] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  // Size variations
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  // Color & Surface variations matching design palette
  const variantStyles: Record<ButtonVariant, string> = {
    // Primary pink accent button matching "+ Add Customer" image
    primary:
      'bg-gradient-to-r from-[#E85D88] to-[#D04873] hover:from-[#d64f78] hover:to-[#be3b64] text-white shadow-md shadow-[#E85D88]/20 border border-[#E85D88]/30',
    
    // Secondary subtle background for internal cards/actions
    secondary:
      'bg-[#2B1B28] hover:bg-[#392435] text-slate-200 border border-[#2B1B28] hover:border-[#E85D88]/40',
    
    // Outline style for table actions or filters
    outline:
      'bg-transparent border border-[#2B1B28] text-slate-300 hover:text-white hover:bg-[#1E1627] hover:border-[#E85D88]/50',
    
    // Ghost button for clean navigation/icon triggers
    ghost:
      'bg-transparent text-slate-400 hover:text-white hover:bg-[#1E1627]',
    
    // Danger state for destructive operations
    danger:
      'bg-rose-600/90 hover:bg-rose-600 text-white shadow-md shadow-rose-900/30',
  };

  const widthStyle = fullWidth ? 'w-full' : 'w-auto';

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      {...rest}
    >
      {/* Loading Spinner */}
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : (
        <>
          {/* Left Icon */}
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />}

          {/* Label Content */}
          {children && <span>{children}</span>}

          {/* Right Icon */}
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
        </>
      )}
    </button>
  );
};