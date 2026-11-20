import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SHOP_SORTS, type ShopSort } from '../../../../shared/shopFilters';

/**
 * Shop filter state lives in the URL so filtered views can be shared and the
 * back button works:
 *
 *   /collections/:slug   → collection preset (home "View all", footer, navbar)
 *   /products            → all products
 *   /products?category=new-arrivals  → legacy navbar links, treated as a collection
 *
 *   ?cat=a,b  &size=M,L  &color=red,pink  &min=2000  &max=5000
 *   &stock=1  &sale=1    &sort=price-asc  &q=anarkali &page=2
 */

/** Old `?category=` values that are really collections. */
const LEGACY_COLLECTION_ALIASES: Record<string, string> = {
  'new-arrivals': 'new-arrivals',
  'new-arrival': 'new-arrivals',
  'best-seller': 'best-seller',
  'best-sellers': 'best-seller',
};

export interface ShopFilterState {
  collection: string | null;
  categories: string[];
  sizes: string[];
  colors: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  onSale: boolean;
  sort: ShopSort;
  search: string;
  page: number;
}

type ListKey = 'cat' | 'size' | 'color';

const readList = (params: URLSearchParams, key: string) =>
  (params.get(key) || '').split(',').map((v) => v.trim()).filter(Boolean);

const readNumber = (params: URLSearchParams, key: string) => {
  const raw = params.get(key);
  if (raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function useShopFilters(knownCollectionSlugs: string[] = []) {
  const { slug } = useParams<{ slug?: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state: ShopFilterState = useMemo(() => {
    const legacy = params.get('category');
    let collection: string | null = slug || null;
    const categories = readList(params, 'cat');
    if (!collection && legacy && legacy !== 'all') {
      const alias = LEGACY_COLLECTION_ALIASES[legacy];
      if (alias || knownCollectionSlugs.includes(legacy)) collection = alias || legacy;
      else if (!categories.includes(legacy)) categories.push(legacy);
    }
    const sortParam = params.get('sort') as ShopSort | null;
    return {
      collection,
      categories,
      sizes: readList(params, 'size'),
      colors: readList(params, 'color'),
      minPrice: readNumber(params, 'min'),
      maxPrice: readNumber(params, 'max'),
      inStock: params.get('stock') === '1',
      onSale: params.get('sale') === '1',
      sort: SHOP_SORTS.some((s) => s.value === sortParam) ? (sortParam as ShopSort) : 'newest',
      search: params.get('q') || '',
      page: Math.max(1, Number(params.get('page')) || 1),
    };
  }, [params, slug, knownCollectionSlugs]);

  /** Apply changes to the query string; any filter change goes back to page 1. */
  const update = useCallback(
    (changes: Record<string, string | null>, { keepPage = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (!keepPage) next.delete('page');
          return next;
        },
        { replace: !keepPage },
      );
    },
    [setParams],
  );

  const toggleInList = useCallback(
    (key: ListKey, value: string) => {
      const current = key === 'cat' ? state.categories : key === 'size' ? state.sizes : state.colors;
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      // A legacy ?category= that was read as a category filter moves to ?cat=
      // (one that was read as a collection stays put).
      const legacy = params.get('category');
      const dropLegacy = key === 'cat' && legacy !== null && state.categories.includes(legacy);
      update({ [key]: next.join(','), ...(dropLegacy ? { category: null } : {}) });
    },
    [params, state.categories, state.sizes, state.colors, update],
  );

  /** Switch collection (or null for all) and keep the other filters. */
  const setCollection = useCallback(
    (nextSlug: string | null) => {
      const next = new URLSearchParams(params);
      next.delete('category');
      next.delete('page');
      const qs = next.toString();
      navigate(`${nextSlug ? `/collections/${nextSlug}` : '/products'}${qs ? `?${qs}` : ''}`);
    },
    [navigate, params],
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    const q = params.get('q');
    if (q) next.set('q', q);
    const legacy = params.get('category');
    if (legacy && LEGACY_COLLECTION_ALIASES[legacy]) next.set('category', legacy);
    navigate(`${location.pathname}${next.toString() ? `?${next}` : ''}`, { replace: true });
  }, [location.pathname, navigate, params]);

  const activeCount =
    state.categories.length +
    state.sizes.length +
    state.colors.length +
    (state.minPrice !== undefined || state.maxPrice !== undefined ? 1 : 0) +
    (state.inStock ? 1 : 0) +
    (state.onSale ? 1 : 0);

  return { state, update, toggleInList, setCollection, clearAll, activeCount };
}
