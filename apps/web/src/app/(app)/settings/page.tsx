import type { Metadata } from 'next';
import { DEFAULT_YEAR } from '@partners/core';
import { can } from '@partners/rbac';
import { PermissionDenied } from '@partners/ui';
import { getSettings } from '@/features/settings/service';
import { requirePrincipalOrRedirect } from '@/server/session';
import { GeneralSettingsForm } from './general-form';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
  const principal = await requirePrincipalOrRedirect('/settings');
  if (!can(principal, 'settings:manage')) return <PermissionDenied />;
  const settings = await getSettings();
  return <GeneralSettingsForm {...settings} year={DEFAULT_YEAR} />;
}
