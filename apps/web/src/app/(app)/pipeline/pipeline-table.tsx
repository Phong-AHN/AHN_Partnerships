import Link from 'next/link';
import { ENTITY_LABEL, formatRelative } from '@partners/core';
import {
  Badge,
  Empty,
  Table,
  TableMessage,
  TableScroller,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@partners/ui';
import { AskChip, DealValue, DueLabel, PriorityPill, StagePill } from '@/components/domain';
import { StageSelect, type TierChoice } from '@/components/deals/move-stage';
import type { PipelineDeal } from '@/features/deals/queries';

export function PipelineTable({
  deals,
  tiers,
  today,
  now,
  canMove,
}: {
  deals: readonly PipelineDeal[];
  tiers: readonly TierChoice[];
  today: string;
  now: Date;
  canMove: boolean;
}) {
  return (
    <TableScroller>
      <Table>
        <THead>
          <tr>
            <TH>Partner</TH>
            <TH>Deal</TH>
            <TH>Value</TH>
            <TH>Stage</TH>
            <TH>Next action</TH>
            <TH>Due</TH>
            <TH>Owner</TH>
            <TH>Last touch</TH>
          </tr>
        </THead>
        <TBody>
          {deals.length === 0 && (
            <TableMessage colSpan={8}>
              <Empty
                title="No deals match"
                description="Clear a filter to see more."
                className="py-4"
              />
            </TableMessage>
          )}
          {deals.map((deal) => (
            <TR key={deal.id}>
              <TD>
                <Link
                  href={`/partners/${deal.partner.id}`}
                  className="text-ink hover:text-accent-ink font-semibold"
                >
                  {deal.partner.name}
                </Link>
                <div className="mt-0.5">
                  <PriorityPill priority={deal.partner.priority} />
                </div>
              </TD>
              <TD className="max-w-[15rem]">
                <p className="text-ink-soft truncate text-[12.5px]">{deal.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <AskChip askType={deal.askType} short />
                  {deal.entity !== 'AHN' && (
                    <Badge tone="neutral" size="sm">
                      {ENTITY_LABEL[deal.entity].label}
                    </Badge>
                  )}
                </div>
              </TD>
              <TD className="text-[12.5px]">
                <DealValue
                  askType={deal.askType}
                  amountMinor={deal.amountMinor}
                  tierName={deal.tier?.name}
                />
              </TD>
              <TD>
                {canMove ? (
                  <StageSelect
                    deal={{
                      id: deal.id,
                      title: deal.title,
                      partnerName: deal.partner.name,
                      askType: deal.askType,
                      stage: deal.stage,
                      tierId: deal.tierId,
                    }}
                    tiers={tiers}
                    today={today}
                  />
                ) : (
                  <StagePill stage={deal.stage} />
                )}
              </TD>
              <TD className="max-w-[18rem]">
                <span className="text-ink-soft line-clamp-2 text-[12.5px]">
                  {deal.nextAction ?? '-'}
                </span>
              </TD>
              <TD className="text-[12.5px]">
                <DueLabel due={deal.nextActionDue} stage={deal.stage} now={now} />
              </TD>
              <TD className="text-ink-soft text-[12.5px]">
                {deal.owner?.name ?? <span className="text-faint">Unassigned</span>}
              </TD>
              <TD className="text-[12.5px]">
                <span className={deal.stale ? 'text-warning-ink font-medium' : 'text-muted'}>
                  {formatRelative(deal.lastTouchedAt, now)}
                </span>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableScroller>
  );
}
