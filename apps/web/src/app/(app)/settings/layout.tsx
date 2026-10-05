import { can, type Permission } from '@partners/rbac';
import { PageHeader, PermissionDenied } from '@partners/ui';
import { requirePrincipalOrRedirect } from '@/server/session';
import { SettingsTabs } from './settings-tabs';

const SECTIONS: readonly { href: string; label: string; permission: Permission }[] = [
  { href: '/settings', label: 'General', permission: 'settings:manage' },
  { href: '/settings/tiers', label: 'Membership tiers', permission: 'tier:manage' },
  { href: '/settings/users', label: 'Users', permission: 'user:manage' },
  { href: '/settings/import', label: 'Import & export', permission: 'data:import' },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const principal = await requirePrincipalOrRedirect('/settings');
  const visible = SECTIONS.filter((section) => can(principal, section.permission));
  if (visible.length === 0) return <PermissionDenied />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Admin only: targets, membership tiers, users, import and export."
      />
      <SettingsTabs items={visible.map(({ href, label }) => ({ href, label }))} />
      <div className="pt-2">{children}</div>
    </div>
  );
}
