import type { Metadata } from 'next';
import { PageHeader } from '@partners/ui';
import { requirePrincipalOrRedirect } from '@/server/session';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const principal = await requirePrincipalOrRedirect('/dashboard');
  return <PageHeader title={`Welcome, ${principal.name}`} description="Dashboard coming soon." />;
}
