import type { Metadata } from 'next';
import Link from 'next/link';
import { clock } from '@partners/core';
import { can } from '@partners/rbac';
import {
  Badge,
  Empty,
  PageHeader,
  Table,
  TableMessage,
  TableScroller,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Unassigned,
} from '@partners/ui';
import {
  AskChip,
  DealValue,
  DueLabel,
  PriorityPill,
  SectorLabel,
  StagePill,
} from '@/components/domain';
import { listPartners, parsePartnerFilters, type SearchParams } from '@/features/partners/queries';
import { listActiveUsers } from '@/features/users/queries';
import { requirePrincipalOrRedirect } from '@/server/session';
import { PartnerFilters } from './partner-filters';
import { NewPartnerButton } from './partner-form';

export const metadata: Metadata = { title: 'Partners' };
export const dynamic = 'force-dynamic';

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipalOrRedirect('/partners');
  const filters = parsePartnerFilters(await searchParams);
  const [partners, users] = await Promise.all([listPartners(filters), listActiveUsers()]);
  const now = clock.now();
  const filtered = Boolean(filters.q || filters.sector || filters.priority || filters.archived);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Partners"
        description="Every company and organization we are working with for 2027, with its current ask."
        actions={can(principal, 'partner:write') ? <NewPartnerButton users={users} /> : null}
      />

      <PartnerFilters total={partners.length} />

      <TableScroller>
        <Table>
          <THead>
            <tr>
              <TH>Partner</TH>
              <TH>Priority</TH>
              <TH>Current deal</TH>
              <TH>Stage</TH>
              <TH>Next action</TH>
              <TH>Owner</TH>
              <TH align="right">Contacts</TH>
            </tr>
          </THead>
          <TBody>
            {partners.length === 0 && (
              <TableMessage colSpan={7}>
                <Empty
                  title={filtered ? 'No partners match' : 'No partners yet'}
                  description={
                    filtered
                      ? 'Try a different search or clear the filters.'
                      : 'Add one, or import the checklist from Settings.'
                  }
                  className="py-4"
                />
              </TableMessage>
            )}
            {partners.map((partner) => {
              const deal = partner.currentDeal;
              return (
                <TR key={partner.id}>
                  <TD className="max-w-[22rem]">
                    <Link
                      href={`/partners/${partner.id}`}
                      className="text-ink hover:text-accent-ink font-semibold"
                    >
                      {partner.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <SectorLabel sector={partner.sector} className="text-[12px]" />
                      {partner.existingRelationship && (
                        <Badge tone="success" size="sm">
                          Existing
                        </Badge>
                      )}
                      {partner.archivedAt && (
                        <Badge tone="muted" size="sm">
                          Archived
                        </Badge>
                      )}
                    </div>
                  </TD>
                  <TD>
                    <PriorityPill priority={partner.priority} />
                  </TD>
                  <TD>
                    {deal ? (
                      <div className="space-y-1">
                        <AskChip askType={deal.askType} short />
                        <DealValue
                          askType={deal.askType}
                          amountMinor={deal.amountMinor}
                          tierName={deal.tier?.name}
                          className="block text-[12.5px]"
                        />
                      </div>
                    ) : (
                      <span className="text-faint">No deal</span>
                    )}
                  </TD>
                  <TD>{deal ? <StagePill stage={deal.stage} /> : null}</TD>
                  <TD className="max-w-[16rem]">
                    {deal?.nextAction ? (
                      <>
                        <span className="text-ink-soft line-clamp-1 text-[12.5px]">
                          {deal.nextAction}
                        </span>
                        <DueLabel
                          due={deal.nextActionDue}
                          stage={deal.stage}
                          now={now}
                          className="text-[12px]"
                        />
                      </>
                    ) : (
                      <span className="text-faint">-</span>
                    )}
                  </TD>
                  <TD>
                    {partner.owner ? (
                      <span className="text-ink-soft text-[13px]">{partner.owner.name}</span>
                    ) : (
                      <Unassigned />
                    )}
                  </TD>
                  <TD numeric align="right">
                    {partner._count.contacts}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableScroller>
    </div>
  );
}
