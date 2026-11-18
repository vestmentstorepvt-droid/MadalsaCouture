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
          bg-[#0D0B14]
          border-r border-white/[0.06]
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* ── Logo ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-center px-6 py-5 border-b border-white/[0.06]">
          <img
            src={logoImg}
            alt="Madalsa Couture"
            className="h-9 object-contain opacity-95 drop-shadow-md"
          />
        </div>

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin scrollbar-thumb-white/10">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/25 select-none">
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
                            w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl
                            text-sm font-medium transition-all duration-150 group
                            ${isChildActive
                              ? 'text-white/90 bg-white/[0.07]'
                              : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                            }
                          `}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isChildActive
                                ? 'bg-gradient-to-br from-[#E85D88] to-[#c03a6b] text-white shadow-md shadow-[#E85D88]/25'
                                : 'bg-white/[0.05] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/70'
                                }`}
                            >
                              <Icon className="w-4 h-4" />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-white/60' : 'text-white/25'
                              }`}
                          />
                        </button>

                        {/* Accordion children */}
                        <div
                          className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                            }`}
                        >
                          <div className="ml-4 mt-0.5 mb-1 pl-4 border-l border-white/[0.07] space-y-0.5">
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
                                      ? 'text-[#E85D88] bg-[#E85D88]/10'
                                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                                    }
                                  `}
                                >
                                  {({ isActive }) => (
                                    <>
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${isActive ? 'bg-[#E85D88]' : 'bg-white/20'
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
                        flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium
                        transition-all duration-150 group
                        ${isActive
                          ? 'text-white bg-white/[0.07]'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                        }
                      `}
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isActive
                              ? 'bg-gradient-to-br from-[#E85D88] to-[#c03a6b] text-white shadow-md shadow-[#E85D88]/25'
                              : 'bg-white/[0.05] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/70'
                              }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="truncate">{item.label}</span>
                          {isActive && (
                            <span className="ml-auto w-1 h-4 rounded-full bg-gradient-to-b from-[#E85D88] to-[#c03a6b] flex-shrink-0" />
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
        <div className="border-t border-white/[0.06] p-3 space-y-2">
          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150 group"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] group-hover:bg-rose-500/15 transition-colors flex-shrink-0">
              <LogOut className="w-4 h-4" />
            </span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
