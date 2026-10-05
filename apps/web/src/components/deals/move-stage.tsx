'use client';

import { useCallback, useState } from 'react';
import {
  DEAL_STAGE_LABEL,
  formatDate,
  membershipEndDate,
  needsTier,
  parseDateInput,
  PIPELINE_STAGES,
  type AskType,
  type DealStage,
} from '@partners/core';
import { Alert, Button, Dialog, Field, FormActions, Input, Select, Textarea } from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { moveStageAction } from '@/features/deals/actions';
import { money } from '@/components/domain';

export interface MovableDeal {
  id: string;
  title: string;
  partnerName: string;
  askType: AskType;
  stage: DealStage;
  tierId: string | null;
}

export interface TierChoice {
  id: string;
  name: string;
  year: number;
  priceMinor: number;
}

export function tierLabel(tier: TierChoice): string {
  return `${tier.name} ${tier.year} · ${money(tier.priceMinor)}`;
}

/** A move needs a dialog when it asks for something: a tier, a start date or a reason. */
export function moveNeedsDialog(deal: MovableDeal, to: DealStage): boolean {
  if (to === 'LOST') return true;
  if (to === 'WON' && deal.askType === 'CORPORATE_MEMBERSHIP') return true;
  return needsTier(deal.askType, to) && !deal.tierId;
}

function MoveStageForm({
  deal,
  to,
  tiers,
  today,
  onDone,
}: {
  deal: MovableDeal;
  to: DealStage;
  tiers: readonly TierChoice[];
  today: string;
  onDone: (ok: boolean) => void;
}) {
  const move = useAction(moveStageAction, { onSuccess: () => onDone(true) });
  const errors = move.fieldErrors;
  const askTier = needsTier(deal.askType, to) && !deal.tierId;
  const askStart = to === 'WON' && deal.askType === 'CORPORATE_MEMBERSHIP';
  const [start, setStart] = useState(today);
  const startDate = parseDateInput(start);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void move.run({ ...readForm(event.currentTarget), id: deal.id, stage: to });
      }}
    >
      {move.error && Object.keys(errors).length === 0 && (
        <Alert tone="danger" dense>
          {move.error}
        </Alert>
      )}
      {askTier && (
        <Field
          label="Membership tier"
          htmlFor="move-tier"
          required
          hint="A membership deal names its tier from the proposal onwards. Its price is copied onto the deal."
          error={fieldError(errors, 'tierId')}
        >
          <Select id="move-tier" name="tierId" required defaultValue="">
            <option value="" disabled>
              Choose a tier
            </option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tierLabel(tier)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {askStart && (
        <Field
          label="Membership starts"
          htmlFor="move-start"
          required
          hint={
            startDate
              ? `Runs 12 months, to ${formatDate(membershipEndDate(startDate))}.`
              : undefined
          }
          error={fieldError(errors, 'startDate')}
        >
          <Input
            id="move-start"
            name="startDate"
            type="date"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
      )}
      {to === 'LOST' && (
        <Field
          label="Why was it lost?"
          htmlFor="move-reason"
          required
          error={fieldError(errors, 'lostReason')}
        >
          <Textarea
            id="move-reason"
            name="lostReason"
            rows={3}
            required
            autoFocus
            placeholder="Budget went elsewhere this year, wrong contact, timing..."
          />
        </Field>
      )}
      <FormActions>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={to === 'LOST' ? 'danger' : 'primary'}
          size="sm"
          loading={move.pending}
        >
          {to === 'WON'
            ? 'Mark as won'
            : to === 'LOST'
              ? 'Mark as lost'
              : `Move to ${DEAL_STAGE_LABEL[to].label}`}
        </Button>
      </FormActions>
    </form>
  );
}

/**
 * One way to move a deal, from the board, the table and the partner page.
 * `request(deal, to)` moves straight away when nothing needs asking, and
 * opens the dialog when it does. `onSettled(ok)` lets the board drop its
 * optimistic placement if the move did not happen.
 */
export function useMoveStage({
  tiers,
  today,
  onSettled,
}: {
  tiers: readonly TierChoice[];
  today: string;
  onSettled?: (dealId: string, ok: boolean) => void;
}) {
  const [pendingMove, setPendingMove] = useState<{ deal: MovableDeal; to: DealStage } | null>(null);
  const direct = useAction(moveStageAction);

  const request = useCallback(
    async (deal: MovableDeal, to: DealStage) => {
      if (deal.stage === to) return;
      if (moveNeedsDialog(deal, to)) {
        setPendingMove({ deal, to });
        return;
      }
      const result = await direct.run({ id: deal.id, stage: to });
      if (!result.ok && result.fieldErrors?.tierId) {
        // The server knows best: if it wants a tier after all, ask for one.
        setPendingMove({ deal: { ...deal, tierId: null }, to });
        return;
      }
      onSettled?.(deal.id, result.ok);
    },
    [direct, onSettled],
  );

  const dialog = (
    <Dialog
      open={pendingMove !== null}
      onClose={() => {
        if (pendingMove) onSettled?.(pendingMove.deal.id, false);
        setPendingMove(null);
      }}
      title={
        pendingMove
          ? pendingMove.to === 'WON'
            ? `Close ${pendingMove.deal.partnerName} as won`
            : pendingMove.to === 'LOST'
              ? `Close ${pendingMove.deal.partnerName} as lost`
              : `Move ${pendingMove.deal.partnerName} to ${DEAL_STAGE_LABEL[pendingMove.to].label}`
          : ''
      }
      description={pendingMove?.deal.title}
      size="sm"
    >
      {pendingMove && (
        <MoveStageForm
          key={`${pendingMove.deal.id}-${pendingMove.to}`}
          deal={pendingMove.deal}
          to={pendingMove.to}
          tiers={tiers}
          today={today}
          onDone={(ok) => {
            onSettled?.(pendingMove.deal.id, ok);
            setPendingMove(null);
          }}
        />
      )}
    </Dialog>
  );

  return { request, dialog, pending: direct.pending };
}

/** A stage dropdown that goes through the same rules as dragging on the board. */
export function StageSelect({
  deal,
  tiers,
  today,
  disabled,
}: {
  deal: MovableDeal;
  tiers: readonly TierChoice[];
  today: string;
  disabled?: boolean;
}) {
  const { request, dialog, pending } = useMoveStage({ tiers, today });
  return (
    <>
      <Select
        aria-label={`Stage of ${deal.title}`}
        value={deal.stage}
        disabled={disabled || pending}
        onChange={(event) => void request(deal, event.target.value as DealStage)}
        className="h-8 w-auto min-w-[9.5rem] text-[12.5px]"
      >
        {PIPELINE_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {DEAL_STAGE_LABEL[stage].label}
          </option>
        ))}
      </Select>
      {dialog}
    </>
  );
}
