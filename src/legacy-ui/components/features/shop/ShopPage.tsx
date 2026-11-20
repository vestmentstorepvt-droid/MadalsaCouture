import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight, Grid, Search, SlidersHorizontal, X } from 'lucide-react';
import { useGetProductFacetsQuery, useGetProductsQuery, type Product } from '../../../services/productsApi';
import { ProductCard, ProductGrid, ProductGridSkeleton, formatINR } from '../../ui/ProductCard';
import { SectionHeader } from '../../ui/SectionHeader';
import { EmptyState } from '../../ui/EmptyState';
import { COLOR_FAMILIES, SHOP_SORTS, type ShopSort } from '../../../../shared/shopFilters';
import { FilterPanel, JEWEL, THEMED_SCROLLBAR } from './FilterPanel';
import { useShopFilters } from './useShopFilters';
import { ButiPattern } from '../../ui/CollectionBanner';

const PAGE_SIZE = 24;

/** Maroon header of the filter panel (sidebar and mobile sheet), in the home bands' style. */
const FilterHeader: React.FC<{ headingId: string; activeCount?: number; onClear?: () => void; onClose?: () => void }> = ({
  headingId,
  activeCount = 0,
  onClear,
  onClose,
}) => (
  <div className="relative shrink-0 overflow-hidden bg-surface">
    <ButiPattern id={`buti-${headingId}`} color={JEWEL.maroon} />
    <div className="relative flex items-center justify-between px-5 pb-3 pt-4">
      <h2 id={headingId} className="flex items-baseline gap-2 leading-none">
        <span className="-my-2 px-1 py-2 font-script text-4xl" style={{ color: JEWEL.maroon }}>
          Refine
        </span>
        <span className="font-display text-sm font-medium uppercase tracking-[0.2em] text-ink">Filters</span>
      </h2>
      {onClear && activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-sm text-xs text-ink underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e0d1d]"
        >
          Clear all ({activeCount})
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-hairline-soft focus-visible:outline-2 focus-visible:outline-[#5e0d1d]"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
    {/* Gold double rule, as under the home bands' toran */}
    <div className="relative h-[5px] border-y" style={{ borderColor: `${JEWEL.gold}b3` }} />
  </div>
);

const titleCase = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * The one product listing page: /products (all) and /collections/:slug
 * (a collection preset). Shoppers can switch collection and filter by
 * category, size, colour, price, stock and sale; everything is in the URL.
 */
export const ShopPage: React.FC = () => {
  const [knownCollections, setKnownCollections] = useState<string[]>([]);
  const { state, update, toggleInList, setCollection, clearAll, activeCount } = useShopFilters(knownCollections);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Search box (debounced into ?q=) ─────────────────────────────────────
  const [searchDraft, setSearchDraft] = useState(state.search);
  const [lastSearch, setLastSearch] = useState(state.search);
  if (state.search !== lastSearch) {
    setLastSearch(state.search);
    setSearchDraft(state.search);
  }
  useEffect(() => {
    if (searchDraft.trim() === state.search) return;
    const timer = setTimeout(() => update({ q: searchDraft.trim() || null }), 350);
    return () => clearTimeout(timer);
  }, [searchDraft, state.search, update]);

  // Meta Pixel: Search — fires 800ms after the shopper stops typing.
  useEffect(() => {
    if (!searchDraft.trim()) return;
    const timer = setTimeout(() => {
      try {
        const fbq = (window as any).fbq;
        if (typeof fbq === 'function') {
          fbq('track', 'Search', { search_string: searchDraft.trim(), content_category: state.collection || 'all' }, { eventID: `search_${Date.now()}` });
        }
      } catch { /* silent */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: facets } = useGetProductFacetsQuery({ collection: state.collection || undefined, search: state.search });
  const collectionSlugs = useMemo(() => facets?.collections.map((c) => c.slug) ?? [], [facets]);
  useEffect(() => {
    if (collectionSlugs.join() !== knownCollections.join()) setKnownCollections(collectionSlugs);
  }, [collectionSlugs, knownCollections]);

  const { data, isLoading, isError, isFetching, refetch } = useGetProductsQuery({
    collection: state.collection || undefined,
    categories: state.categories,
    sizes: state.sizes,
    colors: state.colors,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    inStock: state.inStock,
    onSale: state.onSale,
    search: state.search,
    sort: SHOP_SORTS.find((s) => s.value === state.sort)?.api,
    page: state.page,
    limit: PAGE_SIZE,
  });
  const products: Product[] = data?.products ?? [];
  const total = data?.pagination?.total ?? products.length;
  const totalPages = data?.pagination?.totalPages ?? 1;

  // ── Mobile sheet: lock scroll, close on Escape ──────────────────────────
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen]);

  // Keep the selected collection tab visible on narrow screens.
  const collectionNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = collectionNavRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active) nav.scrollLeft = active.offsetLeft - nav.clientWidth / 2 + active.offsetWidth / 2;
  }, [state.collection, facets]);

  const goToPage = (page: number) => {
    update({ page: page > 1 ? String(page) : null }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Headings & chips ────────────────────────────────────────────────────
  const collectionName = state.collection
    ? facets?.collections.find((c) => c.slug === state.collection)?.name || titleCase(state.collection)
    : null;
  const title = collectionName || (state.search ? `Results for “${state.search}”` : 'All products');

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...state.categories.map((slug) => ({
      key: `cat-${slug}`,
      label: facets?.categories.find((c) => c.slug === slug)?.name || titleCase(slug),
      remove: () => toggleInList('cat', slug),
    })),
    ...state.sizes.map((size) => ({ key: `size-${size}`, label: `Size ${size}`, remove: () => toggleInList('size', size) })),
    ...state.colors.map((color) => ({
      key: `color-${color}`,
      label: COLOR_FAMILIES.find((f) => f.value === color)?.label || titleCase(color),
      remove: () => toggleInList('color', color),
    })),
    ...(state.minPrice !== undefined || state.maxPrice !== undefined
      ? [{
          key: 'price',
          label:
            state.minPrice !== undefined && state.maxPrice !== undefined
              ? `${formatINR(state.minPrice)} – ${formatINR(state.maxPrice)}`
              : state.minPrice !== undefined
                ? `From ${formatINR(state.minPrice)}`
                : `Up to ${formatINR(state.maxPrice!)}`,
          remove: () => update({ min: null, max: null }),
        }]
      : []),
    ...(state.inStock ? [{ key: 'stock', label: 'In stock', remove: () => update({ stock: null }) }] : []),
    ...(state.onSale ? [{ key: 'sale', label: 'On sale', remove: () => update({ sale: null }) }] : []),
  ];

  const panel = <FilterPanel facets={facets} state={state} update={update} toggleInList={toggleInList} />;
  const showSkeleton = isLoading || (isFetching && products.length === 0);

  return (
    <div className="min-h-screen bg-canvas px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          as="h1"
          eyebrow={state.collection ? 'Collection' : 'Shop'}
          title={title}
          description={state.collection ? undefined : 'Every Madalsa piece, in one place.'}
        />

        {/* Collection switcher */}
        <nav
          ref={collectionNavRef}
          aria-label="Collections"
          className="-mx-4 mt-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex w-max gap-2">
            {[{ slug: null as string | null, name: 'All', count: undefined as number | undefined }, ...(facets?.collections ?? [])].map((c) => {
              const active = (c.slug ?? null) === state.collection;
              return (
                <li key={c.slug ?? 'all'}>
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => !active && setCollection(c.slug)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm whitespace-nowrap transition-colors ${
                      active ? 'border-[#5e0d1d] bg-[#5e0d1d] text-[#f6ead2]' : 'border-hairline bg-surface text-ink hover:border-[#5e0d1d]'
                    }`}
                  >
                    {c.name}
                    {c.count !== undefined && <span className={`text-xs tabular-nums ${active ? 'text-[#e2c27a]' : 'text-faint'}`}>{c.count}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[17rem_1fr] xl:grid-cols-[18rem_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-24 flex max-h-[calc(100svh-7.5rem)] flex-col overflow-hidden rounded-2xl border border-gold-muted bg-surface">
              <FilterHeader activeCount={activeCount} onClear={clearAll} headingId="shop-filter-heading" />
              <div className={`min-h-0 flex-1 overflow-y-auto px-5 ${THEMED_SCROLLBAR}`}>{panel}</div>
            </div>
          </aside>

          <div className="min-w-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-y border-hairline py-3 sm:gap-3">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-sm font-medium text-ink hover:border-ink lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
                {activeCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-xs text-white tabular-nums">{activeCount}</span>
                )}
              </button>

              <label className="relative order-first block w-full sm:order-none sm:w-64">
                <span className="sr-only">Search products</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search products"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  className="h-10 w-full rounded-md border border-hairline bg-surface pl-9 pr-3 text-base text-ink placeholder:text-faint focus:border-ink focus:outline-none sm:text-sm"
                />
              </label>

              <p className="text-sm text-mute tabular-nums" aria-live="polite">
                {showSkeleton ? ' ' : `${total} ${total === 1 ? 'piece' : 'pieces'}`}
              </p>

              <label className="ml-auto flex items-center gap-2 text-sm text-body">
                <ArrowUpDown className="hidden h-4 w-4 text-mute sm:block" aria-hidden="true" />
                <span className="sr-only">Sort</span>
                <select
                  value={state.sort}
                  onChange={(e) => update({ sort: e.target.value === 'newest' ? null : (e.target.value as ShopSort) })}
                  className="h-10 max-w-36 rounded-md border border-hairline bg-surface px-2 text-sm text-ink focus:border-ink focus:outline-none sm:max-w-none sm:px-3"
                >
                  {SHOP_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Active filters */}
            {chips.length > 0 && (
              <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      onClick={chip.remove}
                      aria-label={`Remove filter: ${chip.label}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-hairline-soft pl-3 pr-2 text-xs font-medium text-ink hover:bg-hairline"
                    >
                      {chip.label}
                      <X className="h-3.5 w-3.5 text-mute" aria-hidden="true" />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" onClick={clearAll} className="h-8 px-2 text-xs text-mute underline underline-offset-4 hover:text-ink">
                    Clear all
                  </button>
                </li>
              </ul>
            )}

            {/* Results */}
            <div className={`mt-6 transition-opacity ${isFetching && !showSkeleton ? 'opacity-60' : ''}`}>
              {showSkeleton ? (
                <ProductGridSkeleton />
              ) : isError ? (
                <EmptyState
                  icon={<Grid className="h-8 w-8" />}
                  title="We couldn't load the products"
                  action={<button type="button" onClick={() => refetch()} className="mt-4 inline-flex h-10 items-center rounded-full bg-[#5e0d1d] px-5 text-sm font-medium text-[#f6ead2] ring-1 ring-inset ring-[#e2c27a]/50 hover:bg-[#741427]">Try again</button>}
                />
              ) : products.length === 0 ? (
                <EmptyState
                  icon={<Grid className="h-8 w-8" />}
                  title={activeCount > 0 || state.search ? 'No pieces match these filters' : 'Nothing here yet'}
                  description={activeCount > 0 || state.search ? 'Try removing a filter or two.' : 'New pieces are on their way. Check back soon.'}
                  action={
                    activeCount > 0 ? (
                      <button type="button" onClick={clearAll} className="mt-4 inline-flex h-10 items-center rounded-full bg-[#5e0d1d] px-5 text-sm font-medium text-[#f6ead2] ring-1 ring-inset ring-[#e2c27a]/50 hover:bg-[#741427]">
                        Clear filters
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <ProductGrid>
                  {products.map((product, index) => (
                    <ProductCard
                      key={product._id}
                      href={`/product/${product.slug}`}
                      title={product.name}
                      image={product.primaryImage || product.images?.[0]}
                      price={product.price ?? 0}
                      originalPrice={product.originalPrice}
                      badge={!product.inStock ? 'Sold out' : product.isNewArrival ? 'New' : product.isBestSeller ? 'Bestseller' : undefined}
                      priority={index < 4}
                    />
                  ))}
                </ProductGrid>
              )}
            </div>

            {!showSkeleton && !isError && products.length > 0 && totalPages > 1 && (
              <nav className="mt-14 flex items-center justify-center gap-4" aria-label="Pagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  onClick={() => goToPage(state.page - 1)}
                  disabled={state.page <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-sm text-body tabular-nums">
                  {state.page} / {totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  onClick={() => goToPage(state.page + 1)}
                  disabled={state.page >= totalPages}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="shop-filter-title">
          <button type="button" aria-label="Close filters" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl">
            <FilterHeader headingId="shop-filter-title" onClose={() => setSheetOpen(false)} />
            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${THEMED_SCROLLBAR}`}>{panel}</div>
            <div className="flex items-center gap-3 border-t border-hairline px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={clearAll}
                disabled={activeCount === 0}
                className="h-11 rounded-full border border-gold-muted px-5 text-sm font-medium text-ink hover:border-[#5e0d1d] disabled:opacity-40"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="h-11 flex-1 rounded-full bg-[#5e0d1d] px-5 text-sm font-medium text-[#f6ead2] ring-1 ring-inset ring-[#e2c27a]/50 hover:bg-[#741427]"
              >
                {isFetching ? 'Updating…' : `Show ${total} ${total === 1 ? 'piece' : 'pieces'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopPage;
