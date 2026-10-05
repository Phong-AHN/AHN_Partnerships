import { BadgeCheck } from 'lucide-react';
import {
  daysBetween,
  effectiveMembershipStatus,
  formatDate,
  isRenewalDue,
  toDateInput,
} from '@partners/core';
import { can, type Principal } from '@partners/rbac';
import { Card, CardHeader, Empty } from '@partners/ui';
import { money } from '@/components/domain';
import { MembershipActions } from '@/components/memberships/membership-actions';
import { MembershipStatusCell, PaidCell } from '@/components/memberships/membership-status';
import type { PartnerDetail } from '@/features/partners/queries';

export function MembershipsCard({
  partner,
  principal,
  now,
  renewalNoticeDays,
}: {
  partner: PartnerDetail;
  principal: Principal;
  now: Date;
  renewalNoticeDays: number;
}) {
  const openMembershipYears = new Set(
    partner.deals
      .filter((deal) => deal.askType === 'CORPORATE_MEMBERSHIP' && deal.stage !== 'LOST')
      .map((deal) => deal.year),
  );

  return (
    <Card>
      <CardHeader
        title="Memberships"
        count={partner.memberships.length}
        icon={<BadgeCheck className="size-4" />}
      />
      {partner.memberships.length === 0 ? (
        <Empty
          title="Not a member"
          description="Closing a corporate membership deal as won creates the membership."
          className="py-8"
        />
      ) : (
        <ul className="divide-line divide-y">
          {partner.memberships.map((membership) => {
            const status = effectiveMembershipStatus(membership, now);
            const renewalYear = (membership.deal?.year ?? membership.endDate.getUTCFullYear()) + 1;
            return (
              <li key={membership.id} className="space-y-2 px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-ink text-[13.5px] font-semibold">
                    {membership.tier.name} {membership.tier.year}
                    <span className="tabular text-muted ml-2 font-normal">
                      {money(membership.amountMinor)}
                    </span>
                  </p>
                  <MembershipStatusCell
                    status={status}
                    daysLeft={daysBetween(now, membership.endDate)}
                    renewalDue={isRenewalDue(membership, now, renewalNoticeDays)}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-muted">
                    {formatDate(membership.startDate)} – {formatDate(membership.endDate)}
                  </span>
                  <PaidCell paidAt={membership.paidAt} cancelled={status === 'CANCELLED'} />
                </div>
                {membership.notes && (
                  <p className="text-muted whitespace-pre-line text-[12px]">{membership.notes}</p>
                )}
                <MembershipActions
                  today={toDateInput(now)}
                  canEdit={can(principal, 'membership:write')}
                  canRenew={can(principal, 'deal:write')}
                  membership={{
                    id: membership.id,
                    partnerId: partner.id,
                    partnerName: partner.name,
                    tierName: membership.tier.name,
                    paid: membership.paidAt !== null,
                    cancelled: status === 'CANCELLED',
                    renewalYear,
                    renewalOpen: openMembershipYears.has(renewalYear),
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
