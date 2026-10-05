import type { Metadata } from 'next';
import Link from 'next/link';
import { AlarmClock, BadgeCheck, CalendarClock, Layers, RefreshCw, Target } from 'lucide-react';
import {
  ASK_TYPE_LABEL,
  clock,
  DEAL_STAGE_LABEL,
  DEFAULT_YEAR,
  formatDate,
  daysBetween,
  SECTOR_LABEL,
} from '@partners/core';
import {
  Alert,
  BarList,
  Card,
  CardBody,
  CardHeader,
  DonutChart,
  Empty,
  FilterPills,
  PageHeader,
  ProgressBar,
  Stat,
} from '@partners/ui';
import { AskChip, DueLabel, money, StagePill } from '@/components/domain';
import { getDashboard } from '@/features/dashboard/queries';
import { listDealYears } from '@/features/deals/queries';
import { getSettings } from '@/features/settings/service';
import { requirePrincipalOrRedirect } from '@/server/session';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const principal = await requirePrincipalOrRedirect('/dashboard');
  const requested = Number((await searchParams).year);
  const year = Number.isInteger(requested) && requested > 2000 ? requested : DEFAULT_YEAR;
  const now = clock.now();
  const settings = await getSettings();
  const [data, years] = await Promise.all([
    getDashboard(year, now, settings.renewalNoticeDays),
    listDealYears(),
  ]);

  const target = settings.annualTargetMinor;
  const progress = target ? Math.round((data.bookedMinor / target) * 100) : null;
  const pipelineHref = (query: string) => `/pipeline?year=${year}${query}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${year} partnerships`}
        description={`Hi ${principal.name.split(' ')[0]}. Booked against target, what is still in play, and what needs doing this week.`}
        actions={
          years.length > 1 ? (
            <FilterPills
              items={[...new Set([...years, DEFAULT_YEAR])]
                .sort((a, b) => a - b)
                .map((value) => ({
                  href: `/dashboard?year=${value}`,
                  label: String(value),
                  active: value === year,
                }))}
            />
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={`Booked ${year}`}
          value={money(data.bookedMinor, true)}
          detail={
            target
              ? `${progress}% of ${money(target, true)} target · ${data.wonCount} won`
              : `${data.wonCount} won · no target set`
          }
          icon={<Target className="size-4" />}
          tone="success"
        />
        <Stat
          label="Weighted pipeline"
          value={money(data.weightedMinor, true)}
          detail={`${money(data.pipelineMinor, true)} unweighted · ${data.openDeals} open deals`}
          icon={<Layers className="size-4" />}
          tone="accent"
        />
        <Stat
          label="Active members"
          value={data.activeMembers}
          detail={`${data.renewals.length} up for renewal in ${settings.renewalNoticeDays} days`}
          icon={<BadgeCheck className="size-4" />}
          tone="info"
        />
        <Stat
          label="Overdue follow-ups"
          value={data.overdue}
          detail={data.overdue > 0 ? 'Next action date has passed' : 'Nothing overdue'}
          icon={<AlarmClock className="size-4" />}
          tone={data.overdue > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {target ? (
        <Card padded>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-ink text-[13.5px] font-semibold">Booked vs {year} target</p>
            <p className="tabular text-muted text-[12.5px]">
              {money(data.bookedMinor)} of {money(target)} · weighted pipeline would add{' '}
              {money(data.weightedMinor)}
            </p>
          </div>
          <ProgressBar
            value={data.bookedMinor}
            max={target}
            tone="success"
            label={`Booked ${progress}% of target`}
          />
        </Card>
      ) : (
        <Alert tone="info" title="No annual target yet">
          An admin can set the {year} revenue target in Settings to track booked against it.
        </Alert>
      )}

      {data.tierless > 0 && (
        <Alert
          tone="warning"
          action={
            <Link
              href={pipelineHref('&ask=CORPORATE_MEMBERSHIP')}
              className="text-[13px] font-medium underline-offset-4 hover:underline"
            >
              Review
            </Link>
          }
        >
          {data.tierless} open membership deal{data.tierless === 1 ? ' has' : 's have'} no tier yet,
          so {data.tierless === 1 ? 'it adds' : 'they add'} nothing to the pipeline value. Choose a
          tier before sending the proposal.
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Funnel"
            description={`Deals for ${year} by stage. The bar is the count; the value is the stage total.`}
          />
          <CardBody>
            <BarList
              linkAs={Link}
              labelWidth="8rem"
              items={data.funnel.map((row) => ({
                key: row.stage,
                label: DEAL_STAGE_LABEL[row.stage].label,
                value: row.count,
                tone: row.stage === 'WON' ? 'success' : row.stage === 'LOST' ? 'danger' : 'accent',
                hint: row.amountMinor > 0 ? money(row.amountMinor, true) : undefined,
                href: pipelineHref(`&view=table&stage=${row.stage}`),
              }))}
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="By ask" description="Open and won deals, what we are asking for." />
            <CardBody>
              <DonutChart
                linkAs={Link}
                caption="Deals by ask"
                segments={data.byAsk.map((row) => ({
                  key: row.askType,
                  label: `${ASK_TYPE_LABEL[row.askType].label}${row.amountMinor > 0 ? ` · ${money(row.amountMinor, true)}` : ''}`,
                  value: row.count,
                  tone: ASK_TYPE_LABEL[row.askType].tone,
                  href: pipelineHref(`&ask=${row.askType}`),
                }))}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Partners by sector" />
            <CardBody>
              <BarList
                linkAs={Link}
                labelWidth="12rem"
                items={data.bySector.map((row) => ({
                  key: row.sector,
                  label: SECTOR_LABEL[row.sector].label,
                  value: row.count,
                  href: `/partners?sector=${row.sector}`,
                }))}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="This week"
            count={data.dueSoon.length}
            icon={<CalendarClock className="size-4" />}
            description="Next actions due in the next 7 days, overdue first."
            actions={
              <Link
                href="/pipeline?view=table&due=week"
                className="text-accent-ink text-[12.5px] font-medium hover:underline"
              >
                All
              </Link>
            }
          />
          {data.dueSoon.length === 0 ? (
            <Empty title="Nothing due this week" className="py-8" />
          ) : (
            <ul className="divide-line divide-y">
              {data.dueSoon.map((deal) => (
                <li key={deal.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/partners/${deal.partner.id}`}
                      className="text-ink hover:text-accent-ink text-[13.5px] font-semibold"
                    >
                      {deal.partner.name}
                    </Link>
                    <p className="text-ink-soft truncate text-[12.5px]">
                      {deal.nextAction ?? deal.title}
                    </p>
                  </div>
                  <AskChip askType={deal.askType} short />
                  <StagePill stage={deal.stage} />
                  <span className="text-muted w-24 truncate text-[12px]">
                    {deal.owner?.name ?? 'Unassigned'}
                  </span>
                  <DueLabel
                    due={deal.nextActionDue}
                    stage={deal.stage}
                    now={now}
                    className="w-24 text-right text-[12.5px]"
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Renewals"
            count={data.renewals.length}
            icon={<RefreshCw className="size-4" />}
            description={`Memberships ending in the next ${settings.renewalNoticeDays} days.`}
            actions={
              <Link
                href="/members?view=renewals"
                className="text-accent-ink text-[12.5px] font-medium hover:underline"
              >
                All
              </Link>
            }
          />
          {data.renewals.length === 0 ? (
            <Empty title="No renewals coming up" className="py-8" />
          ) : (
            <ul className="divide-line divide-y">
              {data.renewals.map((membership) => (
                <li key={membership.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/partners/${membership.partner.id}`}
                      className="text-ink hover:text-accent-ink text-[13.5px] font-semibold"
                    >
                      {membership.partner.name}
                    </Link>
                    <p className="text-muted text-[12.5px]">
                      {membership.tier.name} · {money(membership.amountMinor)}
                      {!membership.paidAt && <span className="text-danger-ink"> · unpaid</span>}
                    </p>
                  </div>
                  <span className="tabular text-warning-ink text-right text-[12.5px] font-medium">
                    {formatDate(membership.endDate)}
                    <span className="text-muted block text-[11.5px] font-normal">
                      in {daysBetween(now, membership.endDate)}d
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
