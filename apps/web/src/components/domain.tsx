import {
  ASK_TYPE_LABEL,
  ASK_TYPE_SHORT,
  daysBetween,
  DEAL_STAGE_LABEL,
  formatDate,
  formatMoney,
  isClosedStage,
  PRIORITY_LABEL,
  SECTOR_LABEL,
  type AskType,
  type DealStage,
  type Priority,
  type Sector,
} from '@partners/core';
import { Badge, cn, StatusPill } from '@partners/ui';

/**
 * How the pipeline's recurring facts look, decided once. Plain components
 * with no hooks, so server and client screens render them identically.
 */

export function StagePill({ stage, size = 'sm' }: { stage: DealStage; size?: 'sm' | 'md' }) {
  return <StatusPill descriptor={DEAL_STAGE_LABEL[stage]} size={size} />;
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return <StatusPill descriptor={PRIORITY_LABEL[priority]} size="sm" variant="outline" />;
}

export function SectorLabel({ sector, className }: { sector: Sector; className?: string }) {
  return (
    <span className={cn('text-muted text-[12.5px]', className)}>{SECTOR_LABEL[sector].label}</span>
  );
}

export function AskChip({ askType, short }: { askType: AskType; short?: boolean }) {
  const descriptor = ASK_TYPE_LABEL[askType];
  return (
    <Badge tone={descriptor.tone} size="sm" title={descriptor.hint}>
      {short ? ASK_TYPE_SHORT[askType] : descriptor.label}
    </Badge>
  );
}

/** "Title Package · $50,000", "$12,000 est.", or "No tier yet" for an unpriced membership. */
export function DealValue({
  askType,
  amountMinor,
  tierName,
  className,
}: {
  askType: AskType;
  amountMinor: number | null;
  tierName?: string | null;
  className?: string;
}) {
  const money =
    amountMinor !== null
      ? formatMoney(amountMinor, 'USD', { compact: false }).replace(/\.00$/, '')
      : null;
  let text: string;
  if (askType === 'CORPORATE_MEMBERSHIP') {
    text = tierName ? `${tierName}${money ? ` · ${money}` : ''}` : 'No tier yet';
  } else {
    text = money ? `${money} est.` : 'No estimate';
  }
  const muted =
    (askType === 'CORPORATE_MEMBERSHIP' && !tierName) ||
    (askType !== 'CORPORATE_MEMBERSHIP' && !money);
  return (
    <span className={cn('tabular', muted ? 'text-faint' : 'text-ink', className)}>{text}</span>
  );
}

/** A next-action due date that turns red once it has passed. */
export function DueLabel({
  due,
  stage,
  now,
  className,
}: {
  due: Date | string | null;
  stage: DealStage;
  now: Date;
  className?: string;
}) {
  if (!due) return <span className={cn('text-faint', className)}>No date</span>;
  const date = typeof due === 'string' ? new Date(due) : due;
  const days = daysBetween(now, date);
  const open = !isClosedStage(stage);
  const tone =
    open && days < 0
      ? 'text-danger-ink font-semibold'
      : open && days <= 2
        ? 'text-warning-ink font-medium'
        : 'text-muted';
  const text =
    open && days < 0
      ? `${-days}d overdue`
      : open && days === 0
        ? 'Due today'
        : open && days === 1
          ? 'Due tomorrow'
          : formatDate(date);
  return (
    <span className={cn('tabular whitespace-nowrap', tone, className)} title={formatDate(date)}>
      {text}
    </span>
  );
}

export function money(amountMinor: number | null | undefined, compact = false): string {
  if (amountMinor === null || amountMinor === undefined) return '-';
  return formatMoney(amountMinor, 'USD', { compact }).replace(/\.00$/, '');
}
