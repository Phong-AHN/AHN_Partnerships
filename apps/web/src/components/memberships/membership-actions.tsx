'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleCheck, RefreshCw, XCircle } from 'lucide-react';
import { Button, ConfirmDialog, Dialog, Field, FormActions, Input, Textarea } from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import {
  cancelMembershipAction,
  markPaidAction,
  renewMembershipAction,
} from '@/features/memberships/actions';

export interface MembershipActionTarget {
  id: string;
  partnerId: string;
  partnerName: string;
  tierName: string;
  paid: boolean;
  cancelled: boolean;
  renewalYear: number;
  renewalOpen: boolean;
}

export function MembershipActions({
  membership,
  today,
  canEdit,
  canRenew,
}: {
  membership: MembershipActionTarget;
  today: string;
  canEdit: boolean;
  canRenew: boolean;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const pay = useAction(markPaidAction, { onSuccess: () => setPaying(false) });
  const cancel = useAction(cancelMembershipAction, { onSuccess: () => setCancelling(false) });
  const renew = useAction(renewMembershipAction, {
    onSuccess: (data) => router.push(`/partners/${data.partnerId}`),
  });

  if (membership.cancelled) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {canEdit &&
        (membership.paid ? (
          <Button
            size="xs"
            variant="ghost"
            loading={pay.pending}
            onClick={() => void pay.run({ id: membership.id, paid: false })}
          >
            Mark unpaid
          </Button>
        ) : (
          <Button size="xs" variant="secondary" onClick={() => setPaying(true)}>
            <CircleCheck className="size-3.5" />
            Mark paid
          </Button>
        ))}
      {canRenew &&
        (membership.renewalOpen ? (
          <span className="text-muted px-2 text-[12px]">{membership.renewalYear} renewal open</span>
        ) : (
          <Button
            size="xs"
            variant="secondary"
            loading={renew.pending}
            onClick={() => void renew.run({ id: membership.id })}
          >
            <RefreshCw className="size-3.5" />
            Renew for {membership.renewalYear}
          </Button>
        ))}
      {canEdit && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setCancelling(true)}
          aria-label={`Cancel ${membership.partnerName} membership`}
        >
          <XCircle className="size-3.5" />
          Cancel
        </Button>
      )}

      <Dialog
        open={paying}
        onClose={() => setPaying(false)}
        title={`${membership.partnerName} paid`}
        size="sm"
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void pay.run({ ...readForm(event.currentTarget), id: membership.id, paid: true });
          }}
        >
          <Field
            label="Paid on"
            htmlFor={`paid-${membership.id}`}
            error={fieldError(pay.fieldErrors, 'paidOn')}
          >
            <Input
              id={`paid-${membership.id}`}
              name="paidOn"
              type="date"
              max={today}
              defaultValue={today}
            />
          </Field>
          <FormActions>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPaying(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={pay.pending}>
              Mark paid
            </Button>
          </FormActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() => void cancel.run({ id: membership.id, reason })}
        title={`Cancel ${membership.partnerName}'s ${membership.tierName} membership?`}
        description="It stops counting as active. The record stays, and the deal that created it can then be reopened."
        confirmLabel="Cancel membership"
        cancelLabel="Keep it"
        variant="danger"
        busy={cancel.pending}
      >
        <Field label="Reason (optional)" htmlFor={`cancel-${membership.id}`}>
          <Textarea
            id={`cancel-${membership.id}`}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
