import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Heart, Sparkles, ShoppingBag, Trash2,
  RefreshCw, ArrowRight, Tag
} from 'lucide-react';
import { optimizeImage } from '../../../utils/imageUtils';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';

import {
  useGetWishlistQuery,
  useRemoveFromWishlistMutation,
  type WishlistItem,
} from '../../../services/wishlistApi';

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);


// ── Loading skeleton ──────────────────────────────────────────────────────────
const WishlistSkeleton = () => (
  <div className="animate-pulse rounded-2xl border border-hairline bg-white overflow-hidden shadow-sm">
    <div className="h-52 bg-slate-200" />
    <div className="p-4 space-y-2">
      <div className="h-4 w-3/4 rounded-full bg-slate-200" />
      <div className="h-3 w-1/3 rounded-full bg-slate-100" />
      <div className="h-8 w-full rounded-xl bg-slate-200 mt-3" />
    </div>
  </div>
);

// ── Single wishlist card ───────────────────────────────────────────────────────
const WishlistCard: React.FC<{
  item: WishlistItem;
  onRemove: (productId: string) => void;
  isRemoving: boolean;
}> = ({ item, onRemove, isRemoving }) => (
  <div className="group relative rounded-2xl border border-hairline bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    {/* Remove button */}
    <button
      type="button"
      onClick={() => onRemove(item._id)}
      disabled={isRemoving}
      className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-hairline text-slate-400 hover:text-rose-500 hover:border-rose-200 transition shadow-sm disabled:opacity-50"
      aria-label="Remove from wishlist"
    >
      {isRemoving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>

    {/* Product image */}
    <Link to={`/product/${item.slug}`} className="block h-52 bg-white border-b border-hairline overflow-hidden flex items-center justify-center">
      {item.primaryImage ? (
        <img
          src={optimizeImage(item.primaryImage, 400)}
          alt={item.title}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="h-full flex items-center justify-center">
          <ShoppingBag className="w-10 h-10 text-slate-300" />
        </div>
      )}
    </Link>

    {/* Info */}
    <div className="p-4 space-y-3">
      <div>
        <Link to={`/product/${item.slug}`} className="hover:text-accent transition-colors">
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
            {item.title}
          </h3>
        </Link>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Tag className="w-3 h-3 text-accent" />
          <span className="text-sm font-bold text-slate-800">{formatINR(item.basePrice)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-1 border-t border-hairline">
        <Link
          to={`/product/${item.slug}`}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-ink text-white text-xs font-semibold uppercase tracking-wide hover:bg-ink transition"
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Choose size &amp; add to bag <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const WishlistPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortValue, setSortValue] = useState<'featured' | 'price-high' | 'price-low'>('featured');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [removeError, setRemoveError] = useState<string | null>(null);

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { data: wishlistData = [], isLoading, isError, refetch } = useGetWishlistQuery(undefined, { skip: !isAuthenticated });

  // ── APIs ──────────────────────────────────────────────────────────────────
  // DELETE /api/v1/wishlist/:productId → { data: { wishlist: ObjectId[] } }
  const [removeFromWishlist] = useRemoveFromWishlistMutation();

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const filtered = wishlistData.filter((item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (sortValue === 'price-high') return b.basePrice - a.basePrice;
      if (sortValue === 'price-low') return a.basePrice - b.basePrice;
      return 0;
    });
  }, [wishlistData, searchTerm, sortValue]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  // DELETE /api/v1/wishlist/:productId
  // URL Param: productId (MongoDB ObjectId string)
  const handleRemove = useCallback(async (itemId: string) => {
    setRemoveError(null);
    setRemovingIds((prev) => new Set(prev).add(itemId));
    try {
      await removeFromWishlist(itemId).unwrap();
    } catch {
      setRemoveError('Could not remove this item. Please try again.');
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [removeFromWishlist]);


  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.1),_transparent_28%),linear-gradient(145deg,_#FFF9F1_0%,_#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="text-center space-y-3 pt-8">
          <p className="eyebrow">Curated Favourites</p>
          <h1 className="text-4xl text-slate-900 font-semibold">Wishlist</h1>
          <div className="mx-auto h-0.5 w-12 bg-ink" />
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            A personal edit of your favourite couture pieces, ready whenever you are.
          </p>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-hairline p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Heart className="w-4 h-4 text-accent" />
            <span className="font-semibold">{wishlistData.length}</span> saved {wishlistData.length === 1 ? 'piece' : 'pieces'}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <label className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-slate-600">
              <Search className="w-4 h-4 text-accent flex-shrink-0" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search wishlist…"
                className="bg-transparent outline-none min-w-0 w-40"
              />
            </label>
            {/* Sort */}
            <select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value as typeof sortValue)}
              className="rounded-xl border border-hairline bg-surface px-3 py-2 text-sm text-slate-700 outline-none cursor-pointer"
            >
              <option value="featured">Featured</option>
              <option value="price-high">Price: High → Low</option>
              <option value="price-low">Price: Low → High</option>
            </select>
            {/* Refresh */}
            <button
              type="button"
              onClick={() => refetch()}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-hairline text-slate-500 hover:bg-slate-50 transition"
              title="Refresh wishlist"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {removeError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{removeError}</p>
        )}

        {/* ── Body ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(3)].map((_, i) => <WishlistSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-8 py-14 text-center">
            <p className="text-base font-semibold text-rose-700">Failed to load your wishlist.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : wishlistData.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-ink/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h2 className="font-serif text-2xl text-slate-800">Your wishlist is feeling light</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Start exploring refined collections and save your favourite pieces for later.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 mt-2 bg-ink px-8 text-white h-11 rounded-full text-sm font-medium transition-colors hover:bg-ink-hover"
            >
              Discover Collections
            </Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-slate-500 text-sm">No items match "<strong>{searchTerm}</strong>"</p>
            <button onClick={() => setSearchTerm('')} className="text-xs text-accent hover:underline">Clear search</button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <WishlistCard
                key={item._id}
                item={item}
                onRemove={handleRemove}
                isRemoving={removingIds.has(item._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
