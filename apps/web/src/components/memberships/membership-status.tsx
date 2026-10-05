import { formatDate, MEMBERSHIP_STATUS_LABEL, type MembershipStatus } from '@partners/core';
import { Badge, StatusPill } from '@partners/ui';

export function MembershipStatusCell({
  status,
  daysLeft,
  renewalDue,
}: {
  status: MembershipStatus;
  daysLeft: number;
  renewalDue: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusPill descriptor={MEMBERSHIP_STATUS_LABEL[status]} size="sm" />
      {status === 'ACTIVE' && renewalDue && (
        <Badge tone="warning" size="sm">
          {daysLeft === 0 ? 'Ends today' : `Ends in ${daysLeft}d`}
        </Badge>
      )}
    </span>
  );
}

export function PaidCell({ paidAt, cancelled }: { paidAt: Date | null; cancelled: boolean }) {
  if (paidAt) {
    return (
      <Badge tone="success" size="sm" title={`Paid ${formatDate(paidAt)}`}>
        Paid {formatDate(paidAt)}
      </Badge>
    );
  }
  return cancelled ? (
    <span className="text-faint text-[12.5px]">-</span>
  ) : (
    <Badge tone="danger" size="sm" variant="outline">
      Unpaid
    </Badge>
  );
}
