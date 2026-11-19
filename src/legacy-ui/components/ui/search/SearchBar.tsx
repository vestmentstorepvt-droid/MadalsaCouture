

import React, { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onSearch: (value: string) => void;
  debounceTime?: number;
  placeholder?: string;
  className?: string;
  showClearButton?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: externalValue,
  onSearch,
  debounceTime = 300,
  placeholder = 'Search by name, email or phone...',
  className = '',
  showClearButton = true,
  ...rest
}) => {
  const [searchTerm, setSearchTerm] = useState<string>(externalValue || '');
  const [prevExternalValue, setPrevExternalValue] = useState<string | undefined>(externalValue);

  // Sync state during render when external prop changes
  if (externalValue !== undefined && externalValue !== prevExternalValue) {
    setPrevExternalValue(externalValue);
    setSearchTerm(externalValue);
  }

  // Keep the latest callback in a ref so an inline `onSearch` does not restart the debounce
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Debounce user input; skip the initial mount so it never overrides parent state (e.g. page)
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const handler = setTimeout(() => {
      onSearchRef.current(searchTerm);
    }, debounceTime);

    return () => clearTimeout(handler);
  }, [searchTerm, debounceTime]);

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <div className={`relative flex items-center w-full max-w-md ${className}`}>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white text-slate-800 text-sm placeholder-slate-400 rounded-lg border border-slate-200 pl-4 pr-10 py-2.5 transition-all duration-200 focus:outline-none focus:border-slate-300 focus:ring-2 focus:ring-ink/20"
        {...rest}
      />

      <div className="absolute right-3 flex items-center justify-center text-slate-400">
        {showClearButton && searchTerm ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            aria-label="Clear search input"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <Search className="w-4 h-4 pointer-events-none text-slate-500" />
        )}
      </div>
    </div>
  );
};

export default SearchBar;