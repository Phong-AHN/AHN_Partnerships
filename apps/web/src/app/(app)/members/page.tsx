import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, CircleDollarSign, RefreshCw, Wallet } from 'lucide-react';
import { clock, formatDate, toDateInput } from '@partners/core';
import { can } from '@partners/rbac';
import {
  Empty,
  FilterPills,
  PageHeader,
  Stat,
  Table,
  TableMessage,
  TableScroller,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@partners/ui';
import { money, SectorLabel } from '@/components/domain';
import { MembershipActions } from '@/components/memberships/membership-actions';
import { MembershipStatusCell, PaidCell } from '@/components/memberships/membership-status';
import {
  listMemberships,
  memberCounts,
  parseMemberView,
  type MemberView,
} from '@/features/memberships/queries';
import { getSettings } from '@/features/settings/service';
import { requirePrincipalOrRedirect } from '@/server/session';

export const metadata: Metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

const VIEW_LABEL: Record<MemberView, string> = {
  active: 'Active',
  renewals: 'Renewal due',
  unpaid: 'Unpaid',
  expired: 'Expired',
  cancelled: 'Cancelled',
  all: 'All',
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const principal = await requirePrincipalOrRedirect('/members');
  const view = parseMemberView((await searchParams).view);
  const now = clock.now();
  const { renewalNoticeDays } = await getSettings();
  const [rows, counts] = await Promise.all([
    listMemberships(view, now, renewalNoticeDays),
    memberCounts(now, renewalNoticeDays),
  ]);
  const today = toDateInput(now);
  const canEdit = can(principal, 'membership:write');
  const canRenew = can(principal, 'deal:write');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        description={`Corporate members won through the pipeline. A membership runs 12 months; renewals show up ${renewalNoticeDays} days before the end date.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active members"
          value={counts.byView.active}
          icon={<BadgeCheck className="size-4" />}
          tone="success"
        />
        <Stat
          label="Active membership value"
          value={money(counts.activeValueMinor, true)}
          detail="Sum of the prices signed"
          icon={<Wallet className="size-4" />}
          tone="accent"
        />
        <Stat
          label="Unpaid"
          value={counts.byView.unpaid}
          detail={
            counts.unpaidValueMinor > 0
              ? `${money(counts.unpaidValueMinor)} outstanding`
              : 'Nothing outstanding'
          }
          icon={<CircleDollarSign className="size-4" />}
          tone={counts.byView.unpaid > 0 ? 'danger' : 'neutral'}
        />
        <Stat
          label="Renewal due"
          value={counts.byView.renewals}
          detail={`Ending in the next ${renewalNoticeDays} days`}
          icon={<RefreshCw className="size-4" />}
          tone={counts.byView.renewals > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <FilterPills
        items={(Object.keys(VIEW_LABEL) as MemberView[]).map((key) => ({
          href: key === 'active' ? '/members' : `/members?view=${key}`,
          label: VIEW_LABEL[key],
          count: counts.byView[key],
          active: key === view,
        }))}
      />

      <TableScroller>
        <Table>
          <THead>
            <tr>
              <TH>Member</TH>
              <TH>Tier</TH>
              <TH align="right">Amount</TH>
              <TH>Term</TH>
              <TH>Status</TH>
              <TH>Payment</TH>
              <TH align="right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TableMessage colSpan={7}>
                <Empty
                  title={
                    view === 'active'
                      ? 'No active members yet'
                      : `Nothing under ${VIEW_LABEL[view].toLowerCase()}`
                  }
                  description="A membership is created when a corporate membership deal is closed as won on the pipeline."
                  className="py-4"
                />
              </TableMessage>
            )}
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`/partners/${row.partner.id}`}
                    className="text-ink hover:text-accent-ink font-semibold"
                  >
                    {row.partner.name}
                  </Link>
                  <SectorLabel sector={row.partner.sector} className="block text-[12px]" />
                </TD>
                <TD>
                  {row.tier.name} <span className="text-muted">{row.tier.year}</span>
                </TD>
                <TD numeric align="right">
                  {money(row.amountMinor)}
                </TD>
                <TD className="whitespace-nowrap text-[12.5px]">
                  {formatDate(row.startDate)} – {formatDate(row.endDate)}
                </TD>
                <TD>
                  <MembershipStatusCell
                    status={row.effectiveStatus}
                    daysLeft={row.daysLeft}
                    renewalDue={row.renewalDue}
                  />
                </TD>
                <TD>
                  <PaidCell paidAt={row.paidAt} cancelled={row.effectiveStatus === 'CANCELLED'} />
                </TD>
                <TD align="right">
                  <MembershipActions
                    today={today}
                    canEdit={canEdit}
                    canRenew={canRenew}
                    membership={{
                      id: row.id,
                      partnerId: row.partner.id,
                      partnerName: row.partner.name,
                      tierName: row.tier.name,
                      paid: row.paidAt !== null,
                      cancelled: row.effectiveStatus === 'CANCELLED',
                      renewalYear: row.renewalYear,
                      renewalOpen: row.renewalOpen,
                    }}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableScroller>
    </div>
  );
}
