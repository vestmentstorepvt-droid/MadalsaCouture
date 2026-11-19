import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  LayoutDashboard,
  Users,
  Package,
  Ticket,
  LogOut,
  ShoppingBag,
  RotateCcw,
  FolderTree,
  Tag,
  Layers,
  Boxes,
  Image as ImageIcon,
  Globe,
  ChevronDown,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import type { RootState } from '../../../store';
import { NAV_ITEMS } from '../../../config/adminNavigation';
import { useLogout } from '../../../hooks/useLogout';
const logoImg = '/assets/file.png';

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  'User Management': Users,
  Categories: FolderTree,
  Tags: Tag,
  Collections: Layers,
  Products: Package,
  Orders: ShoppingBag,
  Exchanges: RotateCcw,
  Inventory: Boxes,
  Coupon: Ticket,
  Notifications: Bell,
  'Media Library': ImageIcon,
  CMS: Globe,
};

// Nav groups for visual separation
const GROUP_LABELS: Record<string, string> = {
  Dashboard: 'Overview',
  'User Management': 'Management',
  Categories: 'Catalog',
  Tags: 'Catalog',
  Collections: 'Catalog',
  Products: 'Catalog',
  Orders: 'Catalog',
  Exchanges: 'Catalog',
  Inventory: 'Catalog',
  Coupon: 'Finance',
  Notifications: 'Engagement',
  'Media Library': 'Assets',
  CMS: 'Content',
};

export const Sidebar = ({ isOpen: controlledIsOpen, onClose }: SidebarProps) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const performLogout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpenLocal, setIsOpenLocal] = useState(false);
  const [expandedLabel, setExpandedLabel] = useState<string | null>(() => {
    // Auto-expand CMS group if on a CMS route
    if (location.pathname.startsWith('/admin/cms')) return 'CMS';
    return null;
  });

  const isOpen = controlledIsOpen ?? isOpenLocal;

  const closeSidebar = () => {
    if (onClose) onClose();
    else setIsOpenLocal(false);
  };

  const visibleNavItems = user
    ? NAV_ITEMS.filter((item) => item.roles.includes(user.role))
    : [];

  const handleLogout = async () => {
    closeSidebar();
    await performLogout();
    navigate('/login', { replace: true });
  };

  // Build grouped nav items
  const groups: { label: string; items: typeof visibleNavItems }[] = [];
  for (const item of visibleNavItems) {
    const group = GROUP_LABELS[item.label] ?? 'Other';
    const existing = groups.find((g) => g.label === group);
    if (existing) existing.items.push(item);
    else groups.push({ label: group, items: [item] });
  }

  return (
    <>
      {/* Mobile Backdrop (the open button lives in the top Navbar) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex flex-col
          bg-canvas
          border-r border-hairline
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* ── Logo ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-center px-6 py-5 border-b border-hairline">
          <img
            src={logoImg}
            alt="Madalsa Couture"
            className="h-10 object-contain"
          />
        </div>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <p className="eyebrow mb-1.5 select-none px-3">
                {group.label}
              </p>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = ICON_MAP[item.label] ?? LayoutDashboard;

                  if (item.children) {
                    const isExpanded = expandedLabel === item.label;
                    const isChildActive = item.children.some((c) =>
                      location.pathname.startsWith(c.path)
                    );

                    return (
                      <div key={item.path}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLabel(isExpanded ? null : item.label)
                          }
                          className={`
                            w-full flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-md
                            text-sm font-medium transition-all duration-150 group
                            ${isChildActive
                              ? 'text-ink bg-hairline-soft'
                              : 'text-body hover:text-ink hover:bg-hairline-soft'
                            }
                          `}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors ${isChildActive
                                ? 'text-ink'
                                : 'text-mute group-hover:text-ink'
                                }`}
                            >
                              <Icon className="w-4 h-4" />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-ink' : 'text-faint'
                              }`}
                          />
                        </button>

                        {/* Accordion children */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                            }`}
                        >
                          <div className="ml-4 mt-0.5 mb-1 pl-4 border-l border-hairline space-y-0.5">
                            {item.children
                              .filter(
                                (child) =>
                                  user && child.roles.includes(user.role)
                              )
                              .map((child) => (
                                <NavLink
                                  key={child.path}
                                  to={child.path}
                                  onClick={closeSidebar}
                                  className={({ isActive }) => `
                                    flex items-center gap-2 py-2 pl-3 pr-2 rounded-lg text-xs font-medium
                                    transition-all duration-150
                                    ${isActive
                                      ? 'text-ink bg-hairline-soft'
                                      : 'text-body hover:text-ink hover:bg-hairline-soft'
                                    }
                                  `}
                                >
                                  {({ isActive }) => (
                                    <>
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${isActive ? 'bg-ink' : 'bg-hairline-strong'
                                          }`}
                                      />
                                      {child.label}
                                    </>
                                  )}
                                </NavLink>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Regular nav link
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={closeSidebar}
                      className={({ isActive }) => `
                        flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium
                        transition-all duration-150 group
                        ${isActive
                          ? 'text-ink bg-hairline-soft'
                          : 'text-body hover:text-ink hover:bg-hairline-soft'
                        }
                      `}
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors ${isActive
                              ? 'text-ink'
                              : 'text-mute group-hover:text-ink'
                              }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="truncate">{item.label}</span>
                          {isActive && (
                            <span className="ml-auto h-4 w-1 flex-shrink-0 rounded-full bg-ink" aria-hidden="true" />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="border-t border-hairline p-3 space-y-2">
          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium text-body hover:text-red-700 hover:bg-red-50 transition-all duration-150 group"
          >
            <span className="w-7 h-7 flex items-center justify-center rounded-md group-hover:text-red-700 transition-colors flex-shrink-0">
              <LogOut className="w-4 h-4" />
            </span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
