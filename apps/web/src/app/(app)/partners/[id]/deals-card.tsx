import Link from 'next/link';
import { BadgeCheck, CalendarClock, ExternalLink, Handshake } from 'lucide-react';
import { ENTITY_LABEL, formatDate, toDateInput } from '@partners/core';
import { can, type Principal } from '@partners/rbac';
import { Badge, Card, CardHeader, Empty } from '@partners/ui';
import { AskChip, DealValue, DueLabel, StagePill } from '@/components/domain';
import { EditDealButton, NewDealButton } from '@/components/deals/deal-form';
import { StageSelect, type TierChoice } from '@/components/deals/move-stage';
import type { PartnerDetail } from '@/features/partners/queries';
import type { UserOption } from '@/features/users/queries';

export function DealsCard({
  partner,
  principal,
  users,
  tiers,
  now,
}: {
  partner: PartnerDetail;
  principal: Principal;
  users: readonly UserOption[];
  tiers: readonly TierChoice[];
  now: Date;
}) {
  const canWrite = can(principal, 'deal:write');
  const canMove = can(principal, 'deal:move_stage');
  const today = toDateInput(now);

  return (
    <Card>
      <CardHeader
        title="Deals"
        count={partner.deals.length}
        icon={<Handshake className="size-4" />}
        description="What we are asking this partner for, by year."
        actions={
          canWrite ? (
            <NewDealButton
              partnerId={partner.id}
              partnerName={partner.name}
              tiers={tiers}
              users={users}
            />
          ) : null
        }
      />
      {partner.deals.length === 0 ? (
        <Empty
          title="No deals yet"
          description="Open one for the ask that fits: membership, referral or strategic."
          className="py-8"
        />
      ) : (
        <ul className="divide-line divide-y">
          {partner.deals.map((deal) => (
            <li key={deal.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink text-[14px] font-semibold leading-5">{deal.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
                    <AskChip askType={deal.askType} />
                    <DealValue
                      askType={deal.askType}
                      amountMinor={deal.amountMinor}
                      tierName={deal.tier?.name}
                    />
                    <span className="text-faint">·</span>
                    <span className="text-muted">{ENTITY_LABEL[deal.entity].label}</span>
                    <span className="text-faint">·</span>
                    <span className="text-muted">Owner: {deal.owner?.name ?? 'Unassigned'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {canMove ? (
                    <StageSelect
                      deal={{
                        id: deal.id,
                        title: deal.title,
                        partnerName: partner.name,
                        askType: deal.askType,
                        stage: deal.stage,
                        tierId: deal.tierId,
                      }}
                      tiers={tiers}
                      today={today}
                    />
                  ) : (
                    <StagePill stage={deal.stage} size="md" />
                  )}
                  {canWrite && (
                    <EditDealButton
                      partnerId={partner.id}
                      tiers={tiers}
                      users={users}
                      deal={{
                        id: deal.id,
                        title: deal.title,
                        year: deal.year,
                        entity: deal.entity,
                        askType: deal.askType,
                        stage: deal.stage,
                        tierId: deal.tierId,
                        amountMinor: deal.amountMinor,
                        expectedCloseDate: deal.expectedCloseDate,
                        nextAction: deal.nextAction,
                        nextActionDue: deal.nextActionDue,
                        ownerId: deal.ownerId,
                        proposalUrl: deal.proposalUrl,
                        locked: deal.membership !== null,
                      }}
                    />
                  )}
                </div>
              </div>

              {deal.nextAction && (
                <p className="bg-surface-2 flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[12.5px]">
                  <CalendarClock className="text-muted size-3.5" />
                  <span className="text-ink-soft min-w-0 flex-1">{deal.nextAction}</span>
                  <DueLabel due={deal.nextActionDue} stage={deal.stage} now={now} />
                </p>
              )}

              <div className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {deal.expectedCloseDate && (
                  <span>Expected close {formatDate(deal.expectedCloseDate)}</span>
                )}
                {deal.closedAt && <span>Closed {formatDate(deal.closedAt)}</span>}
                {deal.lostReason && (
                  <span className="text-danger-ink">Lost: {deal.lostReason}</span>
                )}
                {deal.proposalUrl && (
                  <Link
                    href={deal.proposalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent-ink inline-flex items-center gap-1 hover:underline"
                  >
                    Proposal
                    <ExternalLink className="size-3" />
                  </Link>
                )}
                {deal.membership && (
                  <Badge
                    tone={deal.membership.status === 'CANCELLED' ? 'muted' : 'success'}
                    size="sm"
                  >
                    <BadgeCheck className="size-3" />
                    {deal.membership.status === 'CANCELLED'
                      ? 'Membership cancelled'
                      : 'Membership created'}
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
