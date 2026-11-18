import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { User, ShoppingBag, Menu, X, ChevronDown, Sparkles, Flame, Shirt, Grid, type LucideIcon } from 'lucide-react';
const madalsaLogo = '/assets/file.png';
import { useLogout } from '../../../hooks/useLogout';
import { selectCartItemCount } from '../../../store/slices/cartSlice';
import type { RootState } from '../../../store';
import AnnouncementBar from '../../sections/landing/AnnouncementBar';
import { useGetCollectionsShowcaseQuery } from '../../../services/cmsApi';

// CategoryItem interface removed since shopCategories is now built dynamically

// SHOP_CATEGORIES is resolved dynamically within the component using useGetCollectionsShowcaseQuery from CMS

export const LandingNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileShopOpen, setIsMobileShopOpen] = useState(false);
  const [navState, setNavState] = useState<'transparent' | 'hidden' | 'solid'>('transparent');

  const { data: collections = [] } = useGetCollectionsShowcaseQuery();

  const sortedCollections = [...collections].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  const shopCategories = [
    ...sortedCollections.map((col) => {
      let icon: LucideIcon = Shirt;
      if (col.slug === 'new-arrival' || col.slug === 'new-arrivals') {
        icon = Sparkles;
      } else if (col.slug === 'best-seller' || col.slug === 'best-sellers') {
        icon = Flame;
      }
      return {
        name: col.name,
        path: `/collections/${col.slug}`,
        icon,
      };
    }),
    {
      name: 'All Products',
      path: '/products',
      icon: Grid,
    },
  ];
  const location = useLocation();
  const navigate = useNavigate();
  const performLogout = useLogout();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const cartCount = useSelector(selectCartItemCount);

  // Track which pathname the dropdown is open for — closes automatically on navigation
  const [menuOpenForPath, setMenuOpenForPath] = useState<string | null>(null);
  const isProfileMenuOpen = menuOpenForPath === location.pathname;
  const setIsProfileMenuOpen = (open: boolean) =>
    setMenuOpenForPath(open ? location.pathname : null);
  const lastScrollYRef = useRef(0);
  const heroVisibleRef = useRef(true);
  const productsVisibleRef = useRef(false);

  const isShopActive = location.pathname.startsWith('/products');
  const isLandingHome = location.pathname === '/';
  const shouldForceSolidState =
    !isLandingHome ||
    location.pathname.startsWith('/product/') ||
    location.pathname.startsWith('/cart') ||
    location.pathname.startsWith('/wishlist') ||
    location.pathname.startsWith('/search') ||
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/account') ||
    location.pathname.startsWith('/orders') ||
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/admin');

  const isSolid = navState === 'solid' || shouldForceSolidState;
  const isHidden = navState === 'hidden';
  const textColorClass = isSolid ? 'text-[#FFF8ED]' : 'text-[#2D211A]';
  const hoverTextClass = isSolid ? 'hover:text-[#D4AF37]' : 'hover:text-[#D4AF37]';

  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setMenuOpenForPath(null);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  // Handle direct click on profile section: redirect to role-based dashboard if authenticated, or /login if not authenticated
  const handleProfileClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      setIsProfileMenuOpen(!isProfileMenuOpen);
    }
  };

  useEffect(() => {
    const updateNavState = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollYRef.current;
      const atTop = currentScrollY <= 24;

      if (shouldForceSolidState) {
        setNavState('solid');
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (atTop) {
        setNavState('transparent');
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const heroVisible = heroVisibleRef.current;
      const productsVisible = productsVisibleRef.current;

      if (heroVisible && !productsVisible) {
        setNavState(scrollingDown ? 'hidden' : 'transparent');
      } else {
        setNavState('solid');
      }

      lastScrollYRef.current = currentScrollY;
    };

    updateNavState();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id === 'hero') {
            heroVisibleRef.current = entry.isIntersecting;
          }

          if (entry.target.id === 'shop') {
            productsVisibleRef.current = entry.isIntersecting;
          }
        });

        updateNavState();
      },
      {
        threshold: [0.15, 0.35, 0.6],
        rootMargin: '-8% 0px -35% 0px',
      },
    );

    const heroSection = document.getElementById('hero');
    const productsSection = document.getElementById('shop');

    if (heroSection) {
      observer.observe(heroSection);
    }

    if (productsSection) {
      observer.observe(productsSection);
    }

    window.addEventListener('scroll', updateNavState, { passive: true });
    window.addEventListener('resize', updateNavState);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateNavState);
      window.removeEventListener('resize', updateNavState);
    };
  }, [shouldForceSolidState]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-out ${isHidden ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        } ${isSolid
          ? 'bg-[#271C16]/95 shadow-[0_12px_30px_rgba(0,0,0,0.16)] backdrop-blur-sm'
          : 'bg-[#FAF7F2] shadow-sm'
        }`}
    >
      {/* Announcement bar sits above the navigation and hero media. */}
      <AnnouncementBar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-1">
          <div className="flex-1 flex items-center justify-start">
            <nav className="hidden items-center space-x-8 md:flex">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `relative py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${isActive ? 'text-[#D4AF37]' : `${textColorClass} ${hoverTextClass}`
                }`
              }
            >
              {({ isActive }) => (
                <>
                  Home
                  <span
                    className={`absolute bottom-0 left-0 h-[1.5px] bg-[#D4AF37] transition-all duration-200 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'
                      }`}
                  />
                </>
              )}
            </NavLink>

            <div className="group relative py-2">
              <button
                type="button"
                className={`flex items-center gap-1.5 text-sm font-medium tracking-wide transition-colors duration-200 ${isShopActive ? 'text-[#D4AF37]' : `${textColorClass} group-hover:text-[#D4AF37]`
                  }`}
              >
                Shop
                <ChevronDown className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
              </button>

              <span
                className={`absolute bottom-0 left-0 h-[1.5px] bg-[#D4AF37] transition-all duration-200 ${isShopActive ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
              />

              <div className="pointer-events-none invisible absolute left-0 top-full pt-3 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                <div className="min-w-48 rounded-xl border border-[#D4AF37]/20 bg-[#181124]/95 px-2 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                  {shopCategories.map((category) => {
                    const Icon = category.icon;

                    return (
                      <Link
                        key={category.name}
                        to={category.path}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-[#D4AF37]"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{category.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <NavLink
              to="/about"
              className={({ isActive }) =>
                `relative py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${isActive ? 'text-[#D4AF37]' : `${textColorClass} ${hoverTextClass}`
                }`
              }
            >
              {({ isActive }) => (
                <>
                  About Us
                  <span
                    className={`absolute bottom-0 left-0 h-[1.5px] bg-[#D4AF37] transition-all duration-200 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'
                      }`}
                  />
                </>
              )}
            </NavLink>
          </nav>

          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`rounded-full p-2 ${isSolid ? 'text-[#FFF8ED]' : 'text-slate-200'
                } hover:text-[#D4AF37] focus:outline-none`}
              aria-label="Toggle Navigation"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
            <Link to="/" className="flex items-center justify-center transition-transform duration-200 hover:scale-105">
              <img
                src={madalsaLogo}
                alt="Madalsa Couture"
                className="h-12 w-auto object-contain drop-shadow-md sm:h-14 md:h-16"
              />
            </Link>
          </div>

          <div className="flex-1 flex items-center justify-end space-x-4 sm:space-x-6">
            {/* Profile Section Button with Auth Check & Role Redirection */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={handleProfileClick}
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold ${textColorClass} transition-colors duration-200 hover:bg-white/15 hover:text-[#D4AF37]`}
                aria-label="Account Profile"
                title={isAuthenticated ? `Signed in as ${user?.name ?? 'User'}` : 'Sign In'}
              >
                {isAuthenticated ? (
                  user?.name?.charAt(0)?.toUpperCase() ?? 'U'
                ) : (
                  <User className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </button>

              {/* Profile Dropdown Menu when user is logged in */}
              {isAuthenticated && isProfileMenuOpen ? (
                <div className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-[#D4AF37]/20 bg-[#181124]/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                  <div className="border-b border-white/10 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-100">{user?.name ?? 'Welcome'}</p>
                    <p className="text-xs text-slate-400">{user?.email ?? 'Signed in'}</p>
                    <span className="mt-1 inline-block rounded bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-semibold text-[#D4AF37] uppercase">
                      {user?.role ?? 'USER'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(isAdmin
                      ? [
                        { label: 'Admin Dashboard', path: '/admin/dashboard' },
                        { label: 'User Management', path: '/admin/user-management' },
                      ]
                      : [
                        { label: 'My Profile', path: '/profile' },
                        { label: 'My Orders', path: '/my-orders' },
                        { label: 'Wishlist', path: '/wishlist' },
                        { label: 'Saved Addresses', path: '/addresses' },
                      ]
                    ).map((item) => (
                      <Link
                        key={item.label}
                        to={item.path}
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-[#D4AF37]"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      onClick={async () => {
                        setIsProfileMenuOpen(false);
                        await performLogout();
                        navigate('/', { replace: true });
                      }}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-rose-300 transition-colors hover:bg-white/5 hover:text-rose-200"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {!isAdmin && (
              <Link
                to="/cart"
                className={`relative rounded-full p-1 ${textColorClass} transition-colors duration-200 hover:bg-white/5 hover:text-[#D4AF37]`}
                aria-label="Shopping Cart"
              >
                <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-500/40 bg-amber-800/80 text-[10px] font-semibold text-amber-200">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          className={`space-y-3 border-b border-amber-900/20 ${isSolid ? 'bg-[#6B4D3E]/95' : 'bg-[#110E1B]/95'
            } px-4 pb-6 pt-4 backdrop-blur-lg md:hidden`}
        >
          <NavLink
            to="/"
            end
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `block text-base font-medium transition-all duration-150 ${isActive ? 'text-[#D4AF37]' : 'text-slate-200 hover:text-[#D4AF37]'
              }`
            }
          >
            Home
          </NavLink>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsMobileShopOpen(!isMobileShopOpen)}
              className="flex w-full items-center justify-between text-base font-medium text-slate-200 hover:text-[#D4AF37]"
            >
              <span>Shop</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isMobileShopOpen ? 'rotate-180 text-[#D4AF37]' : ''
                  }`}
              />
            </button>

            {isMobileShopOpen && (
              <div className="my-2 space-y-2 border-l border-[#D4AF37]/20 pl-4">
                {shopCategories.map((category) => (
                  <Link
                    key={category.name}
                    to={category.path}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsMobileShopOpen(false);
                    }}
                    className="block py-1 text-sm text-slate-300 transition-colors hover:text-[#D4AF37]"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <NavLink
            to="/about"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `block text-base font-medium transition-all duration-150 ${isActive ? 'text-[#D4AF37]' : 'text-slate-200 hover:text-[#D4AF37]'
              }`
            }
          >
            About Us
          </NavLink>

          {/* Profile / Account link in Mobile drawer */}
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleProfileClick();
            }}
            className="flex w-full items-center justify-between text-base font-medium text-slate-200 hover:text-[#D4AF37] pt-2 border-t border-amber-900/30"
          >
            <span>{isAuthenticated ? (isAdmin ? 'Admin Dashboard' : 'My Account') : 'Sign In / Account'}</span>
            <User className="h-5 w-5 text-[#D4AF37]" />
          </button>
        </div>
      )}
    </header>
  );
};

export default LandingNavbar;