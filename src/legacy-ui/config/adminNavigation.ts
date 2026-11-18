
import { type UserRole } from '../types/auth';

export interface NavItem {
  label: string;
  path: string;
  roles: UserRole[];
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', roles: ['ADMIN'] },
  { label: 'User Management', path: '/admin/user-management', roles: ['ADMIN'] },
  { label: 'Categories', path: '/admin/categories', roles: ['ADMIN'] },
  { label: 'Tags', path: '/admin/tags', roles: ['ADMIN'] },
  { label: 'Collections', path: '/admin/collections', roles: ['ADMIN'] },
  { label: 'Products', path: '/admin/products', roles: ['ADMIN'] },
  { label: 'Orders', path: '/admin/orders', roles: ['ADMIN'] },
  { label: 'Exchanges', path: '/admin/exchanges', roles: ['ADMIN'] },
  { label: 'Inventory', path: '/admin/inventory', roles: ['ADMIN'] },
  { label: 'Coupon', path: '/admin/coupons', roles: ['ADMIN'] },
  { label: 'Notifications', path: '/admin/notifications', roles: ['ADMIN'] },
  { label: 'Media Library', path: '/admin/media', roles: ['ADMIN'] },
  {
    label: 'CMS',
    path: '/admin/cms',
    roles: ['ADMIN'],
    children: [
      { label: 'Hero', path: '/admin/cms/hero', roles: ['ADMIN'] },
      { label: 'Announcement Bar', path: '/admin/cms/announcement-bar', roles: ['ADMIN'] },
      { label: 'Banners', path: '/admin/cms/banners', roles: ['ADMIN'] },
      { label: 'About Us', path: '/admin/cms/about-us', roles: ['ADMIN'] },
      { label: 'Contact', path: '/admin/cms/contact', roles: ['ADMIN'] },
      { label: 'Collections', path: '/admin/cms/collections-showcase', roles: ['ADMIN'] },
      { label: 'Featured Sections', path: '/admin/cms/featured-sections', roles: ['ADMIN'] },
      { label: 'Video Cards', path: '/admin/cms/video-cards', roles: ['ADMIN'] },
      { label: 'Static Pages', path: '/admin/cms/static-pages', roles: ['ADMIN'] },
    ],
  },
];
