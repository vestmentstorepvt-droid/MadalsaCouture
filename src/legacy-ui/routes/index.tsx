import { useEffect, Suspense, lazy, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, useLocation, Outlet } from 'react-router-dom';
import { ProtectedRoute } from '../components/shared/navigation/ProtectedRoutes';
import { RoleGuard } from '../components/shared/navigation/RoleGuard';
import { MainLayout } from '../components/layout/dashboard/MainLayout';
import { PublicLayout } from '../components/layout/landing/PublicLayout';
import CustomerAccountLayout from '../components/layout/account/CustomerAccountLayout';

/**
 * Wraps a dynamic import with retry logic.
 * If the chunk fails to load (stale hash after redeployment), it reloads the page once.
 * Prevents the "Failed to fetch dynamically imported module" error.
 */
function lazyRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    importFn().catch(() => {
      // Only reload once to prevent infinite loops
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        // Return a never-resolving promise so React doesn't render stale state
        return new Promise(() => { });
      }
      // Already reloaded once — clear flag and throw to show error boundary
      sessionStorage.removeItem('chunk_reload');
      throw new Error('Failed to load page after retry. Please refresh manually.');
    })
  );
}

// Clear the reload flag on successful page load
if (sessionStorage.getItem('chunk_reload')) {
  sessionStorage.removeItem('chunk_reload');
}

const Login = lazyRetry(() => import('../pages/auth/Login'));
const Signup = lazyRetry(() => import('../pages/auth/Signup'));
const ForgotPassword = lazyRetry(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazyRetry(() => import('../pages/auth/ResetPassword'));
const VerifyEmailChange = lazyRetry(() => import('../pages/auth/VerifyEmailChange'));
const AdminDashboard = lazyRetry(() => import('../pages/admin/adminDashboard'));
const Unauthorized = lazyRetry(() => import('../pages/auth/unauthorized'));
const UserManagement = lazyRetry(() => import('../pages/admin/UserManagement'));
const RecentActivity = lazyRetry(() => import('../pages/admin/recentActivity/RecentActivity'));
const Notifications = lazy(() => import('../pages/admin/Notifications').then(m => ({ default: m.Notifications })));
const Hero = lazyRetry(() => import('../components/sections/landing/Hero'));
const Products = lazy(() => import('../pages/landing-page/Products').then(m => ({ default: m.Products })));
const ProductDetails = lazyRetry(() => import('../pages/landing-page/ProductDetails'));
const About = lazyRetry(() => import('../pages/landing-page/About'));
const CollectionPage = lazyRetry(() => import('../pages/landing-page/CollectionPage'));
const CouponManagement = lazyRetry(() => import('../pages/admin/CouponManagement'));
const CreateCoupon = lazyRetry(() => import('../pages/admin/CreateCoupon'));
const ReviewsAndRatings = lazyRetry(() => import('../pages/admin/ReviewsAndRatings'));
const OrderManagement = lazyRetry(() => import('../pages/admin/OrderManagement'));
const OrderDetail = lazyRetry(() => import('../pages/admin/OrderDetail'));
const ExchangeManagement = lazyRetry(() => import('../pages/admin/ExchangeManagement'));
const ExchangeDetail = lazyRetry(() => import('../pages/admin/ExchangeDetail'));
const CategoryManagement = lazyRetry(() => import('../pages/admin/CategoryManagement'));
const TagManagement = lazyRetry(() => import('../pages/admin/TagManagement'));
const CollectionManagement = lazyRetry(() => import('../pages/admin/CollectionManagement'));
const MyProfilePage = lazyRetry(() => import('../pages/landing-page/account/MyProfilePage'));
const MyOrdersPage = lazyRetry(() => import('../pages/landing-page/account/MyOrdersPage'));
const WishlistPage = lazyRetry(() => import('../pages/landing-page/account/WishlistPage'));
const SavedAddressesPage = lazyRetry(() => import('../pages/landing-page/account/SavedAddressesPage'));

const TermsAndConditions = lazyRetry(() => import('../pages/landing-page/TermsAndConditions'));
const PrivacyPolicy = lazyRetry(() => import('../pages/landing-page/PrivacyPolicy'));
const RefundPolicy = lazyRetry(() => import('../pages/landing-page/RefundPolicy'));
const ShippingPolicy = lazyRetry(() => import('../pages/landing-page/ShippingPolicy'));
const CmsPageRoute = lazyRetry(() => import('../pages/landing-page/CmsPageRoute'));
const Contact = lazyRetry(() => import('../pages/landing-page/Contact'));
const Checkout = lazyRetry(() => import('../pages/landing-page/Checkout'));
const CheckoutSuccess = lazyRetry(() => import('../pages/landing-page/CheckoutSuccess'));
const OrderSuccess = lazyRetry(() => import('../pages/landing-page/OrderSuccess'));
const Cart = lazyRetry(() => import('../pages/landing-page/Cart'));
const ProductManagement = lazyRetry(() => import('../pages/admin/ProductManagement'));
const MediaLibrary = lazyRetry(() => import('../pages/admin/MediaLibrary'));
const AuditLogs = lazyRetry(() => import('../pages/admin/AuditLogs'));
const InventoryManagement = lazyRetry(() => import('../pages/admin/InventoryManagement'));
const AdminProfile = lazyRetry(() => import('../pages/admin/AdminProfile'));
const CmsHeroPage = lazyRetry(() => import('../pages/admin/cms/CmsHeroPage'));
const CmsAnnouncementPage = lazyRetry(() => import('../pages/admin/cms/CmsAnnouncementPage'));
const CmsBannersPage = lazyRetry(() => import('../pages/admin/cms/CmsBannersPage'));
const CmsAboutPage = lazyRetry(() => import('../pages/admin/cms/CmsAboutPage'));
const CmsContactPage = lazyRetry(() => import('../pages/admin/cms/CmsContactPage'));
const CmsCollectionsPage = lazyRetry(() => import('../pages/admin/cms/CmsCollectionsPage'));
const CmsFeaturedPage = lazyRetry(() => import('../pages/admin/cms/CmsFeaturedPage'));
const CmsVideoCardsPage = lazyRetry(() => import('../pages/admin/cms/CmsVideoCardsPage'));
const CmsStaticPagesPage = lazyRetry(() => import('../pages/admin/cms/CmsStaticPagesPage'));

const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
};

const RootLayout = () => {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-[#110E1B]"><div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div></div>}>
        <Outlet />
      </Suspense>
    </>
  );
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <PublicLayout />,
        children: [
          { index: true, element: <Hero /> },
          { path: 'products', element: <Products /> },
          { path: 'collections/:slug', element: <CollectionPage /> },
          { path: 'product/:id', element: <ProductDetails /> },
          { path: 'about', element: <About /> },
          { path: 'terms', element: <TermsAndConditions /> },
          { path: 'privacy-policy', element: <PrivacyPolicy /> },
          { path: 'refund-policy', element: <RefundPolicy /> },
          { path: 'shipping-policy', element: <ShippingPolicy /> },
          { path: 'pages/:slug', element: <CmsPageRoute /> },
          { path: 'contact', element: <Contact /> },
          { path: 'cart', element: <Cart /> },
          { path: 'checkout', element: <Checkout /> },
          { path: 'checkout-success', element: <CheckoutSuccess /> },
        ],
      },
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/verify-email-change', element: <VerifyEmailChange /> },
      { path: '/unauthorized', element: <Unauthorized /> },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <CustomerAccountLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'profile', element: <MyProfilePage /> },
          { path: 'my-orders', element: <MyOrdersPage /> },
          { path: 'wishlist', element: <WishlistPage /> },
          { path: 'addresses', element: <SavedAddressesPage /> },
          { path: 'order-success/:orderId', element: <OrderSuccess /> },
        ],
      },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            path: 'user/dashboard',
            element: <Navigate to="/" replace />,
          },
          {
            path: 'admin/dashboard',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/user-management',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <UserManagement />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/reviews',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <ReviewsAndRatings />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/activity',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <RecentActivity />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/notifications',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <Notifications />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/coupons/create',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <CreateCoupon />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/coupons',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <CouponManagement />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/orders',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <OrderManagement />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/orders/:id',
            element: (
              <RoleGuard allowedRoles={['ADMIN']}>
                <OrderDetail />
              </RoleGuard>
            ),
          },
          { path: 'admin/exchanges', element: <RoleGuard allowedRoles={['ADMIN']}><ExchangeManagement /></RoleGuard> },
          { path: 'admin/exchanges/:id', element: <RoleGuard allowedRoles={['ADMIN']}><ExchangeDetail /></RoleGuard> },
          { path: 'admin/categories', element: <RoleGuard allowedRoles={['ADMIN']}><CategoryManagement /></RoleGuard> },
          { path: 'admin/tags', element: <RoleGuard allowedRoles={['ADMIN']}><TagManagement /></RoleGuard> },
          { path: 'admin/collections', element: <RoleGuard allowedRoles={['ADMIN']}><CollectionManagement /></RoleGuard> },
          { path: 'admin/products', element: <RoleGuard allowedRoles={['ADMIN']}><ProductManagement /></RoleGuard> },
          { path: 'admin/media', element: <RoleGuard allowedRoles={['ADMIN']}><MediaLibrary /></RoleGuard> },
          { path: 'admin/audit-logs', element: <RoleGuard allowedRoles={['ADMIN']}><AuditLogs /></RoleGuard> },
          { path: 'admin/inventory', element: <RoleGuard allowedRoles={['ADMIN']}><InventoryManagement /></RoleGuard> },
          { path: 'admin/profile', element: <RoleGuard allowedRoles={['ADMIN']}><AdminProfile /></RoleGuard> },
          { path: 'admin/cms', element: <Navigate to="/admin/cms/hero" replace /> },
          { path: 'admin/cms/hero', element: <RoleGuard allowedRoles={['ADMIN']}><CmsHeroPage /></RoleGuard> },
          { path: 'admin/cms/announcement-bar', element: <RoleGuard allowedRoles={['ADMIN']}><CmsAnnouncementPage /></RoleGuard> },
          { path: 'admin/cms/banners', element: <RoleGuard allowedRoles={['ADMIN']}><CmsBannersPage /></RoleGuard> },
          { path: 'admin/cms/about-us', element: <RoleGuard allowedRoles={['ADMIN']}><CmsAboutPage /></RoleGuard> },
          { path: 'admin/cms/contact', element: <RoleGuard allowedRoles={['ADMIN']}><CmsContactPage /></RoleGuard> },
          { path: 'admin/cms/collections-showcase', element: <RoleGuard allowedRoles={['ADMIN']}><CmsCollectionsPage /></RoleGuard> },
          { path: 'admin/cms/featured-sections', element: <RoleGuard allowedRoles={['ADMIN']}><CmsFeaturedPage /></RoleGuard> },
          { path: 'admin/cms/video-cards', element: <RoleGuard allowedRoles={['ADMIN']}><CmsVideoCardsPage /></RoleGuard> },
          { path: 'admin/cms/static-pages', element: <RoleGuard allowedRoles={['ADMIN']}><CmsStaticPagesPage /></RoleGuard> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);