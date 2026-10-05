import type { Metadata } from 'next';
import { clock, toDateInput } from '@partners/core';
import { can } from '@partners/rbac';
import { PageHeader } from '@partners/ui';
import {
  listDeals,
  listDealYears,
  parsePipelineFilters,
  type SearchParams,
} from '@/features/deals/queries';
import { getSettings } from '@/features/settings/service';
import { listTierOptions } from '@/features/tiers/queries';
import { listActiveUsers } from '@/features/users/queries';
import { requirePrincipalOrRedirect } from '@/server/session';
import { PipelineBoard } from './pipeline-board';
import { PipelineFilters } from './pipeline-filters';
import { PipelineTable } from './pipeline-table';

export const metadata: Metadata = { title: 'Pipeline' };
export const dynamic = 'force-dynamic';

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipalOrRedirect('/pipeline');
  const filters = parsePipelineFilters(await searchParams, principal.id);
  const now = clock.now();
  const { staleDays } = await getSettings();

  const [deals, users, years, tiers] = await Promise.all([
    listDeals(filters, now, staleDays),
    listActiveUsers(),
    listDealYears(),
    listTierOptions(),
  ]);
  const canMove = can(principal, 'deal:move_stage');
  const today = toDateInput(now);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        description={
          canMove
            ? 'Every deal by stage. Drag a card to move it - closing as won or lost asks for the details first.'
            : 'Every deal by stage.'
        }
      />
      <PipelineFilters users={users} years={years} view={filters.view} total={deals.length} />
      {filters.view === 'board' ? (
        <PipelineBoard deals={deals} tiers={tiers} today={today} now={now} canMove={canMove} />
      ) : (
        <PipelineTable deals={deals} tiers={tiers} today={today} now={now} canMove={canMove} />
      )}
    </div>
  );
}
