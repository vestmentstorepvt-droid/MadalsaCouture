import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Heart, Loader2, Search, ShoppingBag, X } from 'lucide-react';
import { optimizeImage } from '../../../utils/imageUtils';
import type { RootState } from '../../../store';
import { useGetWishlistQuery, useRemoveFromWishlistMutation, type WishlistItem } from '../../../services/wishlistApi';
import { AccountHeading, Panel, btnPrimary, btnSecondary, useAccountToast } from '../../../components/features/account/AccountUI';

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

type Sort = 'saved' | 'price-low' | 'price-high';

const WishlistCard = ({ item, onRemove, removing }: { item: WishlistItem; onRemove: (id: string) => void; removing: boolean }) => (
  <li className="group relative flex flex-col">
    <Link
      to={`/product/${item.slug}`}
      className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-hairline-soft"
      aria-label={item.title}
    >
      {item.primaryImage ? (
        <img
          src={optimizeImage(item.primaryImage, 480)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-faint">
          <ShoppingBag className="h-8 w-8" />
        </span>
      )}
    </Link>
    <button
      type="button"
      onClick={() => onRemove(item._id)}
      disabled={removing}
      className="absolute right-2.5 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur transition-colors hover:bg-surface hover:text-rose-700 disabled:opacity-60"
      aria-label={`Remove ${item.title} from wishlist`}
    >
      {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
    </button>
    <div className="mt-3 flex flex-1 flex-col">
      <Link to={`/product/${item.slug}`} className="line-clamp-2 text-sm text-ink hover:underline hover:underline-offset-4">
        {item.title}
      </Link>
      <p className="mt-1 text-sm font-medium tabular-nums text-ink">{formatINR(item.basePrice)}</p>
      <Link
        to={`/product/${item.slug}`}
        className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-hairline-strong text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
      >
        Choose size
      </Link>
    </div>
  </li>
);

const WishlistSkeleton = () => (
  <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="animate-pulse">
        <div className="aspect-[3/4] rounded-2xl bg-hairline-soft" />
        <div className="mt-3 h-4 w-3/4 rounded-full bg-hairline-soft" />
        <div className="mt-2 h-4 w-1/3 rounded-full bg-hairline-soft" />
      </li>
    ))}
  </ul>
);

const WishlistPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<Sort>('saved');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const { show: toast, node: toastNode } = useAccountToast();

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { data: items = [], isLoading, isError, refetch } = useGetWishlistQuery(undefined, { skip: !isAuthenticated });
  const [removeFromWishlist] = useRemoveFromWishlistMutation();

  const visible = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items;
    if (sort === 'saved') return filtered;
    return [...filtered].sort((a, b) => (sort === 'price-low' ? a.basePrice - b.basePrice : b.basePrice - a.basePrice));
  }, [items, searchTerm, sort]);

  const handleRemove = useCallback(
    async (id: string) => {
      setRemovingIds((prev) => new Set(prev).add(id));
      try {
        await removeFromWishlist(id).unwrap();
        toast('Removed from your wishlist.');
      } catch {
        toast('Could not remove this piece. Please try again.', 'error');
      } finally {
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [removeFromWishlist, toast],
  );

  const count = items.length;

  return (
    <>
      <AccountHeading
        title="Wishlist"
        description={count ? `${count} ${count === 1 ? 'piece' : 'pieces'} saved for later.` : 'Pieces you save will wait for you here.'}
      />

      {isLoading ? (
        <WishlistSkeleton />
      ) : isError ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="text-sm text-body">We couldn’t load your wishlist.</p>
            <button type="button" onClick={() => void refetch()} className={`${btnSecondary} mt-4`}>
              Try again
            </button>
          </div>
        </Panel>
      ) : count === 0 ? (
        <Panel>
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Heart className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-2xl text-ink">Nothing saved yet</p>
            <p className="mt-1 max-w-xs text-sm text-mute">Tap the heart on any piece to keep it here while you decide.</p>
            <Link to="/products" className={`${btnPrimary} mt-6`}>
              Browse the collection
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          {count > 3 ? (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Search your wishlist</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search your wishlist"
                  className="h-11 w-full rounded-full border border-hairline-strong bg-surface pl-10 pr-4 text-base text-ink outline-none placeholder:text-faint focus:border-ink sm:text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-mute">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-11 rounded-full border border-hairline-strong bg-surface px-4 text-sm text-ink outline-none focus:border-ink"
                >
                  <option value="saved">Recently saved</option>
                  <option value="price-low">Price, low to high</option>
                  <option value="price-high">Price, high to low</option>
                </select>
              </label>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">
              Nothing matches “{searchTerm}”.{' '}
              <button type="button" onClick={() => setSearchTerm('')} className="font-medium text-ink underline underline-offset-4">
                Clear search
              </button>
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {visible.map((item) => (
                <WishlistCard key={item._id} item={item} onRemove={(id) => void handleRemove(id)} removing={removingIds.has(item._id)} />
              ))}
            </ul>
          )}
        </>
      )}
      {toastNode}
    </>
  );
};

export default WishlistPage;
