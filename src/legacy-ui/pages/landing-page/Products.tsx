


import React, { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Search, Grid, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGetProductsQuery, type Product } from '../../services/productsApi';
import { ProductCard, ProductGrid, ProductGridSkeleton } from '../../components/ui/ProductCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { EmptyState } from '../../components/ui/EmptyState';

type SortOption = 'default' | 'price:asc' | 'price:desc';

export const Products: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const currentCategory = searchParams.get('category') || 'all';

  // ?q= comes from the header search
  const urlQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(urlQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setSearchTerm(urlQuery);
    setDebouncedSearch(urlQuery);
  }
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
      <div className="min-h-screen bg-canvas px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            as="h1"
            eyebrow="Shop"
            title={getPageTitle()}
            description={isFilteredView ? 'A curated view of the latest pieces.' : 'Every Madalsa piece, in one place.'}
          />

          <div className="mt-8 flex flex-col gap-3 border-y border-hairline py-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:w-80">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search products"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-10 w-full rounded-md border border-hairline bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-body">
              <ArrowUpDown className="h-4 w-4 text-mute" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
                className="h-10 rounded-md border border-hairline bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none"
              >
                <option value="default">Newest first</option>
                <option value="price:asc">Price: low to high</option>
                <option value="price:desc">Price: high to low</option>
              </select>
            </label>
          </div>

          <div className="mt-8">
            {isLoading || (isFetching && products.length === 0) ? (
              <ProductGridSkeleton />
            ) : isError ? (
              <EmptyState
                icon={<Grid className="h-8 w-8" />}
                title="We couldn't load the products"
                action={<button type="button" onClick={() => refetch()} className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-hover">Try again</button>}
              />
            ) : products.length === 0 ? (
              <EmptyState
                icon={<Grid className="h-8 w-8" />}
                title="Nothing here yet"
                description="Try another collection or clear your search."
              />
            ) : (
              <ProductGrid>
                {products.map((product: Product, index) => (
                  <ProductCard
                    key={product._id}
                    href={`/product/${product.slug}`}
                    title={product.name}
                    image={product.primaryImage || product.images?.[0]}
                    price={product.price ?? 0}
                    originalPrice={product.originalPrice}
                    badge={product.isNewArrival ? 'New' : product.isBestSeller ? 'Bestseller' : undefined}
                    priority={index < 4}
                  />
                ))}
              </ProductGrid>
            )}
          </div>

          {!isLoading && !isError && products.length > 0 && totalPages > 1 && (
            <nav className="mt-14 flex items-center justify-center gap-4" aria-label="Pagination">
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => {
                  setPage((prev) => Math.max(1, prev - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={page === 1}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-sm text-body tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                onClick={() => {
                  setPage((prev) => Math.min(totalPages, prev + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={page === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </>
  );
};

export default Products;