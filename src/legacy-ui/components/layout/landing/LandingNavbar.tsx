import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { User, ShoppingBag, Menu, X, ChevronDown, Search, Heart, ArrowRight } from 'lucide-react';
const madalsaLogo = '/assets/file.png';
import { useLogout } from '../../../hooks/useLogout';
import { selectCartItemCount } from '../../../store/slices/cartSlice';
import type { RootState } from '../../../store';
import AnnouncementBar from '../../sections/landing/AnnouncementBar';
import { useGetCollectionsShowcaseQuery } from '../../../services/cmsApi';
import { useGetWishlistQuery } from '../../../services/wishlistApi';
import { optimizeImage } from '../../../utils/imageUtils';
import { ButiPattern } from '../../ui/CollectionBanner';

/**
 * Two tones, like the original site: light at the top of the home page, dark with logo gold
 * once you scroll (and always on inner pages). Gold is never used as text on the light tone.
 */
const navLinkClass = (active: boolean, dark: boolean) =>
  `relative inline-flex h-10 items-center gap-1 px-3 text-sm font-medium uppercase tracking-[0.12em] transition-colors ` +
  `after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:transition-transform after:duration-300 ` +
  (dark ? 'after:bg-gold ' : 'after:bg-ink ') +
  (active
    ? `after:scale-x-100 ${dark ? 'text-gold' : 'text-ink'}`
    : `after:scale-x-0 hover:after:scale-x-100 ${dark ? 'text-white/80 hover:text-white' : 'text-ink/75 hover:text-ink'}`);

const iconButtonClass = (dark: boolean) =>
  `relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
    dark ? 'text-white hover:bg-white/10 hover:text-gold' : 'text-ink hover:bg-hairline-soft'
  }`;

/** Closes a popover on outside click or Escape. */
function useDismiss<T extends HTMLElement = HTMLDivElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

const CountBadge = ({ count, dark }: { count: number; dark: boolean }) =>
  count > 0 ? (
    <span
      className={`absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-medium leading-none tabular-nums ${
        dark ? 'bg-gold text-ink' : 'bg-ink text-white'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  ) : null;

type MenuName = 'shop' | 'profile' | 'mobile' | 'search';

export const LandingNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const performLogout = useLogout();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const cartCount = useSelector(selectCartItemCount);
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const { data: collections = [] } = useGetCollectionsShowcaseQuery();
  const { data: wishlist = [] } = useGetWishlistQuery(undefined, { skip: !isAuthenticated || isAdmin });
  const wishlistCount = Array.isArray(wishlist) ? wishlist.length : 0;

  // Menus are keyed to the current path, so they close by themselves on navigation.
  const [openMenu, setOpenMenu] = useState<{ name: MenuName; path: string } | null>(null);
  const isOpen = (name: MenuName) => openMenu?.name === name && openMenu.path === location.pathname;
  const toggle = (name: MenuName) => setOpenMenu(isOpen(name) ? null : { name, path: location.pathname });
  const close = useCallback(() => setOpenMenu(null), []);

  const shopRef = useDismiss(isOpen('shop'), close);

  // Shop opens on hover (mouse), with a short grace period so the pointer can travel down into
  // the panel. Click still toggles it for touch and keyboard users.
  const shopTimer = useRef<number | undefined>(undefined);
  const hoverOpened = useRef(false);
  useEffect(() => () => window.clearTimeout(shopTimer.current), []);
  const openShopOnHover = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(shopTimer.current);
    if (!isOpen('shop')) {
      hoverOpened.current = true;
      setOpenMenu({ name: 'shop', path: location.pathname });
    }
  };
  const closeShopOnLeave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(shopTimer.current);
    shopTimer.current = window.setTimeout(() => {
      hoverOpened.current = false;
      setOpenMenu((m) => (m?.name === 'shop' ? null : m));
    }, 180);
  };
  const clickShop = () => {
    // A mouse user who opened it by hovering and then clicks expects it to stay open.
    if (hoverOpened.current && isOpen('shop')) return;
    hoverOpened.current = false;
    toggle('shop');
  };
  const profileRef = useDismiss(isOpen('profile'), close);
  const searchRef = useDismiss<HTMLElement>(isOpen('search'), close);
  const [query, setQuery] = useState('');

  // Dual tone: light only at the very top of the home page.
  const isHome = location.pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const dark = !isHome || scrolled;
  const iconButton = iconButtonClass(dark);

  // Publish the header height so the hero can fit the rest of the screen exactly.
  useEffect(() => {
    const el = searchRef.current;
    if (!el) return;
    const publish = () => {
      // Measure without the drop-down search/menu panels.
      const row = el.querySelector<HTMLElement>('[data-header-main]');
      const border = parseFloat(getComputedStyle(el).borderBottomWidth) || 0;
      const height = row ? row.getBoundingClientRect().bottom - el.getBoundingClientRect().top + border : el.offsetHeight;
      document.documentElement.style.setProperty('--site-header-h', `${Math.round(height)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [searchRef]);

  const category = new URLSearchParams(location.search).get('category');
  const isShopActive =
    (location.pathname.startsWith('/products') && !category) || location.pathname.startsWith('/collections');

  const shopLinks = [
    { name: 'All products', path: '/products' },
    { name: 'New arrivals', path: '/products?category=new-arrivals' },
    { name: 'Best sellers', path: '/products?category=best-seller' },
    ...[...collections]
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((col) => ({ name: col.name, path: `/collections/${col.slug}` })),
  ];

  const sortedCollections = [...collections].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const shopOpen = isOpen('shop');

  const accountLinks = isAdmin
    ? [
        { label: 'Admin dashboard', path: '/admin/dashboard' },
        { label: 'Orders', path: '/admin/orders' },
        { label: 'Products', path: '/admin/products' },
      ]
    : [
        { label: 'My profile', path: '/profile' },
        { label: 'My orders', path: '/my-orders' },
        { label: 'Wishlist', path: '/wishlist' },
        { label: 'Saved addresses', path: '/addresses' },
      ];

  const handleAccount = () => {
    if (!isAuthenticated) navigate('/login');
    else toggle('profile');
  };

  const logout = async () => {
    close();
    await performLogout();
    navigate('/', { replace: true });
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    close();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };

  return (
    <header
      ref={searchRef}
      className={`sticky top-0 z-50 w-full border-b transition-[background-color,border-color,box-shadow] duration-300 ${
        dark
          ? 'border-white/10 bg-[#171717]/95 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md'
          : 'border-hairline bg-canvas'
      }`}
    >
      <AnnouncementBar />

      {/* Three columns: links | centred logo | actions. The logo stays dead-centre at every width. */}
      <div data-header-main className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-6 lg:h-[84px] lg:px-8">
        {/* Left */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggle('mobile')}
            className={`${iconButton} -ml-2 lg:hidden`}
            aria-label={isOpen('mobile') ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen('mobile')}
            aria-controls="mobile-nav"
          >
            {isOpen('mobile') ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => toggle('search')}
            className={`${iconButton} lg:hidden`}
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {/* Not `relative`: the panel is placed against the whole sticky header, full width. */}
            <div ref={shopRef} onPointerEnter={openShopOnHover} onPointerLeave={closeShopOnLeave}>
              <button
                type="button"
                onClick={clickShop}
                aria-expanded={shopOpen}
                aria-controls="shop-menu"
                className={navLinkClass(isShopActive, dark)}
              >
                Shop
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${shopOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <div
                id="shop-menu"
                className={`absolute inset-x-0 top-full border-t border-gold-deep/50 bg-[#fbf4e6] shadow-[0_24px_48px_rgba(59,11,24,0.18)] transition-[opacity,transform,visibility] duration-300 ease-out before:absolute before:inset-x-0 before:-top-10 before:h-10 motion-reduce:transition-none ${
                  shopOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
                }`}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <ButiPattern id="buti-shop-menu" color="#5e0d1d" />
                </div>
                <div className="relative mx-auto grid max-w-7xl grid-cols-[minmax(220px,1fr)_3fr] gap-10 px-8 py-9">
                  {/* Text links */}
                  <div className="flex flex-col">
                    <p className="-mb-[0.2em] -mt-[0.3em] self-start pb-[0.15em] pt-[0.3em] font-script text-5xl leading-none text-[#5e0d1d]">
                      Shop
                    </p>
                    <ul className="mt-5 flex flex-col gap-1">
                      {[{ name: 'All products', path: '/products' }, ...sortedCollections.map((c) => ({ name: c.name, path: `/collections/${c.slug}` }))].map(
                        (item) => (
                          <li key={item.path}>
                            <Link
                              to={item.path}
                              onClick={close}
                              className="group/link inline-flex items-center gap-2 py-1 font-display text-2xl font-medium text-[#3b0b18] transition-colors hover:text-[#9a2238] focus-visible:text-[#9a2238]"
                            >
                              {item.name}
                              <ArrowRight
                                className="h-4 w-4 -translate-x-1 opacity-0 transition-[opacity,transform] duration-300 group-hover/link:translate-x-0 group-hover/link:opacity-100"
                                aria-hidden="true"
                              />
                            </Link>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  {/* Collection tiles */}
                  <ul className="grid grid-cols-4 gap-5">
                    {sortedCollections.slice(0, 4).map((col) => (
                      <li key={col.slug}>
                        <Link
                          to={`/collections/${col.slug}`}
                          onClick={close}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="group/tile relative block aspect-[3/4] overflow-hidden rounded-2xl border border-gold-deep/60 shadow-[0_10px_24px_rgba(59,11,24,0.12)]"
                        >
                          {col.imageUrl && (
                            <img
                              src={optimizeImage(col.imageUrl, 400)}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover/tile:scale-105"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#1f050c]/85 via-[#1f050c]/10 to-transparent" />
                          <p className="absolute inset-x-4 bottom-4 font-display text-xl font-semibold text-[#f6ead2]">
                            {col.name}
                            <span className="mt-1.5 block h-px w-8 bg-[#e2c27a] transition-[width] duration-300 group-hover/tile:w-16" />
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <NavLink
              to="/products?category=new-arrivals"
              className={() => navLinkClass(category === 'new-arrivals', dark)}
            >
              New in
            </NavLink>
            <NavLink
              to="/products?category=best-seller"
              className={() => navLinkClass(category === 'best-seller', dark)}
            >
              Best sellers
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => navLinkClass(isActive, dark)}>
              Our story
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => navLinkClass(isActive, dark)}>
              Contact
            </NavLink>
          </nav>
        </div>

        {/* Centre: logo */}
        <Link to="/" className="flex items-center justify-center rounded-md" aria-label="Madalsa Couture, home">
          <img src={madalsaLogo} alt="" className="h-12 w-auto object-contain lg:h-[64px]" />
        </Link>

        {/* Right */}
        <div className="flex items-center justify-end gap-0.5">
          <div className="relative hidden lg:block">
            <button type="button" onClick={() => toggle('search')} className={iconButton} aria-label="Search" aria-expanded={isOpen('search')}>
              <Search className="h-5 w-5" />
            </button>
          </div>

          {!isAdmin && (
            <Link
              to="/wishlist"
              className={`${iconButton} hidden sm:inline-flex`}
              aria-label={wishlistCount > 0 ? `Wishlist, ${wishlistCount} items` : 'Wishlist'}
            >
              <Heart className="h-5 w-5" />
              <CountBadge count={wishlistCount} dark={dark} />
            </Link>
          )}

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={handleAccount}
              aria-label={isAuthenticated ? `Account menu for ${user?.name ?? 'you'}` : 'Sign in'}
              aria-expanded={isAuthenticated ? isOpen('profile') : undefined}
              className={iconButton}
            >
              {isAuthenticated ? (
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${dark ? 'bg-gold text-ink' : 'bg-ink text-white'}`}>
                  {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </span>
              ) : (
                <User className="h-5 w-5" />
              )}
            </button>

            {isAuthenticated && isOpen('profile') && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-hairline bg-surface p-1.5 shadow-lg">
                <div className="border-b border-hairline px-3 pb-3 pt-2">
                  <p className="truncate text-sm font-medium text-ink">{user?.name ?? 'Welcome'}</p>
                  <p className="truncate text-xs text-mute">{user?.email}</p>
                </div>
                <div className="pt-1.5">
                  {accountLinks.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={close}
                      className="flex h-9 items-center rounded-md px-3 text-sm text-body hover:bg-hairline-soft hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={logout}
                    className="flex h-9 w-full items-center rounded-md px-3 text-left text-sm text-body hover:bg-hairline-soft hover:text-ink"
                  >
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isAdmin && (
            <Link
              to="/cart"
              className={iconButton}
              aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}
            >
              <ShoppingBag className="h-5 w-5" />
              <CountBadge count={cartCount} dark={dark} />
            </Link>
          )}
        </div>
      </div>

      {/* Search bar (drops below the header row) */}
      {isOpen('search') && (
        <div className="border-t border-hairline bg-canvas text-ink">
          <form onSubmit={submitSearch} className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:px-6" role="search">
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" aria-hidden="true" />
              <input
                id="site-search"
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anarkalis, sharara sets, suits…"
                className="field pl-9"
              />
            </div>
            <button type="submit" className="btn-sm bg-ink text-white hover:bg-ink-hover">
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {isOpen('mobile') && (
        <nav id="mobile-nav" aria-label="Mobile" className="max-h-[calc(100dvh-7rem)] overflow-y-auto border-t border-hairline bg-canvas text-ink px-4 pb-6 pt-2 lg:hidden">
          <p className="eyebrow px-2 pb-1 pt-3">Shop</p>
          <ul>
            {shopLinks.map((item) => (
              <li key={item.path}>
                <Link to={item.path} onClick={close} className="flex h-11 items-center justify-between rounded-md px-2 text-base text-ink">
                  {item.name}
                  <ArrowRight className="h-4 w-4 text-faint" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="eyebrow mt-3 border-t border-hairline px-2 pb-1 pt-4">Madalsa</p>
          <ul>
            {[
              { name: 'Our story', path: '/about' },
              { name: 'Contact', path: '/contact' },
              { name: 'Shipping policy', path: '/shipping-policy' },
              { name: 'Refunds & exchanges', path: '/refund-policy' },
            ].map((item) => (
              <li key={item.path}>
                <Link to={item.path} onClick={close} className="flex h-11 items-center rounded-md px-2 text-base text-body">
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-hairline pt-4">
            {isAuthenticated ? (
              <>
                <Link to={isAdmin ? '/admin/dashboard' : '/profile'} onClick={close} className="btn-secondary h-11 text-sm">
                  {isAdmin ? 'Dashboard' : 'My account'}
                </Link>
                {!isAdmin ? (
                  <Link to="/wishlist" onClick={close} className="btn-secondary h-11 text-sm">
                    Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
                  </Link>
                ) : (
                  <button type="button" onClick={logout} className="btn-secondary h-11 text-sm">
                    Log out
                  </button>
                )}
              </>
            ) : (
              <>
                <Link to="/login" onClick={close} className="btn-secondary h-11 text-sm">
                  Sign in
                </Link>
                <Link to="/signup" onClick={close} className="btn-primary h-11 text-sm">
                  Create account
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

export default LandingNavbar;
