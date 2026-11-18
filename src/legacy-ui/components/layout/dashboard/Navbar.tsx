import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import {
  Bell,
  Menu,
  LogOut,
  Settings,
  ChevronDown,
  ExternalLink,
  Package,
  RefreshCw,
  Sparkles,
  CheckCheck,
  AlertCircle,
  Clock,
  ShoppingBag,
  LayoutDashboard,
  Inbox,
} from 'lucide-react';
import type { RootState } from '../../../store';
import { useLogout } from '../../../hooks/useLogout';
import { useGetLogsQuery } from '../../../services/notificationsApi';
import { useGetDashboardKpisQuery } from '../../../services/adminOrdersApi';
import { useGetAdminAlertsQuery, useMarkAlertAsReadMutation, useMarkAllAlertsAsReadMutation } from '../../../services/adminAlertsApi';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

// ── Breadcrumb label map ────────────────────────────────────────────────────────
const BREADCRUMB_MAP: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/user-management': 'User Management',
  '/admin/categories': 'Categories',
  '/admin/tags': 'Tags',
  '/admin/collections': 'Collections',
  '/admin/products': 'Products',
  '/admin/orders': 'Orders',
  '/admin/exchanges': 'Exchanges',
  '/admin/inventory': 'Inventory',
  '/admin/audit-logs': 'Audit Logs',
  '/admin/activity': 'Recent Activity',
  '/admin/coupons': 'Coupons',
  '/admin/notifications': 'Notifications',
  '/admin/media': 'Media Library',
  '/admin/profile': 'My Profile',
  '/admin/cms/hero': 'CMS · Hero',
  '/admin/cms/announcement-bar': 'CMS · Announcement Bar',
  '/admin/cms/banners': 'CMS · Banners',
  '/admin/cms/about-us': 'CMS · About Us',
  '/admin/cms/contact': 'CMS · Contact',
  '/admin/cms/collections-showcase': 'CMS · Collections',
  '/admin/cms/featured-sections': 'CMS · Featured Sections',
  '/admin/cms/video-cards': 'CMS · Video Cards',
  '/admin/cms/static-pages': 'CMS · Static Pages',
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  // Prefix match for nested routes
  for (const key of Object.keys(BREADCRUMB_MAP).reverse()) {
    if (pathname.startsWith(key)) return BREADCRUMB_MAP[key];
  }
  return 'Admin Panel';
}

// ── Status badge for notification logs ─────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  sent: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  failed: 'text-rose-600 bg-rose-50 border-rose-200',
  retrying: 'text-amber-600 bg-amber-50 border-amber-200',
};

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const performLogout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notiRef = useRef<HTMLDivElement | null>(null);
  const alertsRef = useRef<HTMLDivElement | null>(null);

  // Fetch latest 8 notification logs for the dropdown (on demand / initial load)
  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useGetLogsQuery({ limit: 8, page: 1 });

  // Fetch dashboard KPIs to show pending order count
  const { data: kpis } = useGetDashboardKpisQuery();

  // Fetch admin alerts
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useGetAdminAlertsQuery({ limit: 10, page: 1 });
  const [markAsRead] = useMarkAlertAsReadMutation();
  const [markAllAsRead] = useMarkAllAlertsAsReadMutation();


  const recentLogs = logsData?.logs ?? [];
  const failedCount = recentLogs.filter((l) => l.status === 'failed').length;
  const pendingOrders = kpis?.orderStatusBreakdown?.find(
    (s) => s.status.toLowerCase() === 'pending'
  )?.count ?? 0;

  // ── Click-outside ───────────────────────────────────────────────────────────
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
      setIsProfileOpen(false);
    }
    if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
      setIsNotiOpen(false);
    }
    if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
      setIsAlertsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await performLogout();
    navigate('/login', { replace: true });
  };

  const pageTitle = getPageTitle(location.pathname);
  const userName = user?.name || user?.email || 'Admin';
  const userInitial = (userName.charAt(0) || 'A').toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-100 shadow-sm">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">

        {/* ── Left: Mobile hamburger + Page title ─────────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-slate-300 flex-shrink-0 hidden sm:block" />
              <h1 className="text-sm font-bold text-slate-800 truncate">{pageTitle}</h1>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ── Right: Actions ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Quick link: pending orders pill */}
          {pendingOrders > 0 && (
            <NavLink
              to="/admin/orders"
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {pendingOrders} pending
            </NavLink>
          )}

          {/* ── Admin Alerts bell ──────────────────────────────────────── */}
          <div className="relative" ref={alertsRef}>
            <button
              type="button"
              onClick={() => {
                setIsAlertsOpen((p) => !p);
                setIsProfileOpen(false);
                setIsNotiOpen(false);
                if (!isAlertsOpen) refetchAlerts();
              }}
              className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition ${
                isAlertsOpen
                  ? 'bg-blue-500/10 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
              aria-label="View admin alerts"
            >
              <Inbox className="w-5 h-5" />
              {alertsData && alertsData.unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[17px] h-[17px] rounded-full bg-blue-500 text-white text-[9px] font-black px-1 leading-none">
                  {alertsData.unreadCount > 9 ? '9+' : alertsData.unreadCount}
                </span>
              )}
            </button>

            {/* Alerts Dropdown */}
            {isAlertsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">Alerts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => markAllAsRead()}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => refetchAlerts()}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${alertsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Alert list */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {alertsLoading ? (
                    <div className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5" />
                      <p className="text-xs">Loading alerts…</p>
                    </div>
                  ) : !alertsData || alertsData.notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <CheckCheck className="w-7 h-7 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-medium">No alerts right now</p>
                    </div>
                  ) : (
                    alertsData.notifications.map((alert) => (
                      <div
                        key={alert._id}
                        className={`px-4 py-3 hover:bg-slate-50 transition cursor-pointer ${
                          !alert.isRead ? 'bg-blue-50/30' : 'opacity-70'
                        }`}
                        onClick={() => {
                          if (!alert.isRead) markAsRead(alert._id);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold ${!alert.isRead ? 'text-slate-800' : 'text-slate-600'} truncate`}>
                                {alert.title}
                              </span>
                              {!alert.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{alert.message}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(alert.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Notifications bell ──────────────────────────────────────── */}
          <div className="relative" ref={notiRef}>
            <button
              type="button"
              id="navbar-notifications-btn"
              onClick={() => {
                setIsNotiOpen((p) => !p);
                setIsProfileOpen(false);
                setIsAlertsOpen(false);
                if (!isNotiOpen) refetchLogs();
              }}
              className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition ${
                isNotiOpen
                  ? 'bg-[#E85D88]/10 text-[#E85D88]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
              aria-label="View notification logs"
            >
              <Bell className="w-5 h-5" />
              {failedCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[17px] h-[17px] rounded-full bg-rose-500 text-white text-[9px] font-black px-1 leading-none">
                  {failedCount > 9 ? '9+' : failedCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {isNotiOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden z-50">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#E85D88]" />
                    <span className="text-sm font-bold text-slate-800">Notification Logs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => refetchLogs()}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <NavLink
                      to="/admin/notifications"
                      onClick={() => setIsNotiOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                      title="Open Notifications Page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </NavLink>
                  </div>
                </div>

                {/* Log list */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {logsLoading ? (
                    <div className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5" />
                      <p className="text-xs">Loading logs…</p>
                    </div>
                  ) : recentLogs.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <CheckCheck className="w-7 h-7 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-medium">No notification logs yet</p>
                    </div>
                  ) : (
                    recentLogs.map((log) => (
                      <div key={log._id} className="px-4 py-3 hover:bg-slate-50 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-800 truncate">{log.type}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLES[log.status] ?? 'text-slate-600 bg-slate-100 border-slate-200'}`}>
                                {log.status === 'sent' && <CheckCheck className="w-2.5 h-2.5" />}
                                {log.status === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
                                {log.status === 'retrying' && <RefreshCw className="w-2.5 h-2.5" />}
                                {log.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{log.recipient}</p>
                            {log.error && (
                              <p className="text-[10px] text-rose-500 mt-0.5 truncate">{log.error}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50">
                  <NavLink
                    to="/admin/notifications"
                    onClick={() => setIsNotiOpen(false)}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#E85D88] hover:text-[#c03a6b] transition"
                  >
                    View all notification logs <ExternalLink className="w-3 h-3" />
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          {/* ── Profile dropdown ────────────────────────────────────────── */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              id="navbar-profile-btn"
              onClick={() => {
                setIsProfileOpen((p) => !p);
                setIsNotiOpen(false);
                setIsAlertsOpen(false);
              }}
              className={`flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-2xl border transition ${
                isProfileOpen
                  ? 'border-[#E85D88]/30 bg-[#E85D88]/5 shadow-sm'
                  : 'border-slate-200 bg-white hover:shadow-sm hover:border-slate-300'
              }`}
              aria-haspopup="true"
              aria-expanded={isProfileOpen}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E85D88] to-[#c03a6b] flex items-center justify-center text-white text-xs font-black shadow-md shadow-[#E85D88]/25 flex-shrink-0">
                {userInitial}
              </div>
              {/* Name */}
              <div className="hidden sm:block text-left min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[100px]">{userName}</p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-[#E85D88]" />
                  {user?.role === 'ADMIN' ? 'Super Admin' : user?.role ?? 'Admin'}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden z-50">
                {/* User info header */}
                <div className="px-4 py-3.5 bg-gradient-to-br from-slate-900 to-[#1A1428] border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E85D88] to-[#c03a6b] flex items-center justify-center text-white font-black text-sm shadow-md flex-shrink-0">
                      {userInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{userName}</p>
                      <p className="text-[10px] text-white/50 truncate">{user?.email ?? ''}</p>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#E85D88]/20 text-[#E85D88] border border-[#E85D88]/30">
                        <Sparkles className="w-2 h-2" /> {user?.role ?? 'ADMIN'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="py-1.5">
                  <NavLink
                    to="/admin/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Settings className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    My Profile
                  </NavLink>
                  <NavLink
                    to="/admin/notifications"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    Notifications
                  </NavLink>
                  <NavLink
                    to="/admin/products"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Package className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    Products
                  </NavLink>
                </div>

                <div className="border-t border-slate-100 py-1.5">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
