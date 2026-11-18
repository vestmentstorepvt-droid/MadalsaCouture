


import React, { useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { Search, Grid, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGetProductsQuery, type Product } from '../../services/productsApi';
import { optimizeImage } from '../../utils/imageUtils';

type SortOption = 'default' | 'price:asc' | 'price:desc';

export const Products: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const currentCategory = searchParams.get('category') || 'all';

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [page, setPage] = useState(1);

  // Ensure best sellers are always sorted by newest first
  const effectiveSort = currentCategory === 'best-seller' && sortOption === 'default'
    ? 'createdAt:desc'
    : sortOption;

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: productsData, isLoading, isError, isFetching, refetch } = useGetProductsQuery({
    category: currentCategory,
    sort: effectiveSort,
    search: debouncedSearch,
    page,
    limit: 20
  });

  const products: Product[] = productsData?.products ?? [];
  const totalPages = productsData?.pagination?.totalPages ?? 1;

  // Reset page when category, search, or sort changes
  React.useEffect(() => {
    setPage(1);
  }, [currentCategory, debouncedSearch, sortOption]);

  // ── Meta Pixel: Search ──────────────────────────────────────────────────
  // Fires a debounced Search event 800ms after the user stops typing.
  React.useEffect(() => {
    if (!searchTerm.trim()) return;
    const timer = setTimeout(() => {
      try {
        const fbq = (window as any).fbq;
        if (typeof fbq === 'function') {
          fbq('track', 'Search', {
            search_string: searchTerm.trim(),
            content_category: currentCategory || 'all',
          }, { eventID: `search_${Date.now()}` });
        }
      } catch { /* silent */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps
  // ──────────────────────────────────────────────────────────────────────


  const getPageTitle = () => {
    switch (currentCategory) {
      case 'new-arrivals':
        return 'New Arrivals Collection';
      case 'best-seller':
        return 'Best Seller Statement Pieces';
      case 'ethnic':
        return 'Heritage Ethnic Wear';
      case 'western':
        return 'Western Collection';
      case 'all':
        return 'All Products & Collections';
      default:
        // Format slug dynamically (e.g. "fusion-wear" -> "Fusion Wear Collection")
        return currentCategory
          ? `${currentCategory
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')} Collection`
          : 'All Products & Collections';
    }
  };

  const isFilteredView = Boolean(location.search);

  return (
    <>
      <div className="min-h-screen bg-[#ffffff] pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
          <div className="space-y-2 text-center pt-4 sm:pt-6">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.35em] text-[#D4AF37]">
              MADALSA Couture Edit
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl tracking-wide text-slate-900">
              {getPageTitle()}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              {isFilteredView ? 'A curated view of the latest luxury pieces.' : 'Browse every signature look in one refined collection.'}
            </p>
            <div className="mx-auto mt-3 h-0.5 w-16 bg-[#D4AF37]" />
          </div>

          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 shadow-sm sm:flex-row">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search couture pieces..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="default">Newest First</option>
                <option value="price:asc">Price: Low to High</option>
                <option value="price:desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {isLoading || (isFetching && products.length === 0) ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div key={item} className="animate-pulse space-y-2 rounded-2xl border border-slate-100 bg-white p-2 sm:p-3">
                  <div className="aspect-[3/4] w-full rounded-xl bg-slate-200" />
                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="space-y-3 rounded-2xl border border-rose-100 bg-white py-16 text-center">
              <Grid className="mx-auto h-10 w-10 text-rose-300" />
              <h3 className="text-base font-medium text-slate-700">We couldn't load the products</h3>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 border border-slate-800 px-6 py-2 text-xs uppercase tracking-widest text-slate-800 hover:bg-slate-800 hover:text-white transition-all"
              >
                Try again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-white py-16 text-center">
              <Grid className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="text-base font-medium text-slate-700">No items found in this collection</h3>
              <p className="mx-auto max-w-sm text-xs text-slate-400">
                Try selecting another category or clearing your search term to view available pieces.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
              {products.map((product: Product) => (
                <Link
                  key={product._id}
                  to={`/product/${product.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:border-[#D4AF37]/40 hover:shadow-md cursor-pointer"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-slate-50">
                    <img
                      src={optimizeImage(product.primaryImage || product.images?.[0], 600)}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                      onError={(event) => {
                        event.currentTarget.src = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800';
                      }}
                    />

                    <div className="absolute left-2 top-2 flex flex-col gap-1 sm:left-2.5 sm:top-2.5">
                      {product.isNewArrival && (
                        <span className="rounded bg-[#110E1B] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                          New
                        </span>
                      )}
                      {product.isBestSeller && (
                        <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-white">
                          Bestseller
                        </span>
                      )}
                    </div>

                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="absolute right-2 top-2 rounded bg-[#D4AF37] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-black">
                        {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between space-y-1.5 p-3 sm:p-4">
                    <div>
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {product.category}
                      </span>
                      <h3 className="mt-0.5 line-clamp-1 text-xs sm:text-sm font-medium text-slate-800 transition-colors group-hover:text-[#D4AF37]">
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex items-baseline gap-1.5 pt-0.5">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900">
                        ₹{(product.price ?? 0).toLocaleString('en-IN')}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                          ₹{(product.originalPrice ?? 0).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoading && !isError && products.length > 0 && totalPages > 1 && (
            <div className="mt-8 sm:mt-12 flex items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => {
                  setPage((prev) => Math.max(1, prev - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={page === 1}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:border-[#D4AF37]/50 hover:text-[#D4AF37] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <span className="text-xs sm:text-sm font-medium text-slate-600 tracking-wider">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => {
                  setPage((prev) => Math.min(totalPages, prev + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={page === totalPages}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:border-[#D4AF37]/50 hover:text-[#D4AF37] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Products;