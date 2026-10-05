import { canAny, type Principal } from './engine';
import type { Permission } from './permissions';

/**
 * Navigation is derived from the permission matrix rather than hand-written per
 * role, so a menu can never hide a section from the role it exists for.
 */
export interface NavItem {
  href: string;
  label: string;
  /** Lucide icon name, resolved in the design system. */
  icon: string;
  /** Shown when any of these is held. */
  permissions: readonly Permission[];
  description?: string;
  /** Renders a live count badge fed by the layout. */
  badge?: 'overdue' | 'renewals';
}

export interface NavGroup {
  id: string;
  label: string;
  items: readonly NavItem[];
}

const GROUPS: readonly NavGroup[] = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        permissions: ['workspace:read'],
        description: 'Booked vs target, pipeline value, what is due this week.',
      },
      {
        href: '/pipeline',
        label: 'Pipeline',
        icon: 'FolderKanban',
        permissions: ['workspace:read'],
        badge: 'overdue',
        description: 'Every deal by stage. Drag to move.',
      },
      {
        href: '/partners',
        label: 'Partners',
        icon: 'Building2',
        permissions: ['workspace:read'],
        description: 'Companies and organizations, with contacts and history.',
      },
      {
        href: '/members',
        label: 'Members',
        icon: 'BadgeCheck',
        permissions: ['workspace:read'],
        badge: 'renewals',
        description: 'Corporate members, renewals and payment.',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      {
        href: '/settings',
        label: 'Settings',
        icon: 'Settings',
        permissions: ['settings:manage', 'tier:manage', 'user:manage', 'data:import'],
        description: 'Targets, membership tiers, users, import and export.',
      },
    ],
  },
];

export function navigationFor(principal: Principal): NavGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAny(principal, item.permissions)),
  })).filter((group) => group.items.length > 0);
}

/** Where signing in lands. Every role that can sign in can read the dashboard. */
export function landingPathFor(_principal: Principal): string {
  return '/dashboard';
}
