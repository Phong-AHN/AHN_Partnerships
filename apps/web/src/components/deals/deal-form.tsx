'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import {
  ASK_TYPE_LABEL,
  ASK_TYPES,
  DEAL_STAGE_LABEL,
  DEFAULT_YEAR,
  defaultDealTitle,
  ENTITIES,
  ENTITY_LABEL,
  minorToDollarsInput,
  OPEN_STAGES,
  toDateInput,
  type AskType,
  type DealStage,
  type Entity,
} from '@partners/core';
import { Alert, Button, DialogTrigger, Field, FormActions, Input, Select } from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { createDealAction, updateDealAction } from '@/features/deals/actions';
import type { UserOption } from '@/features/users/queries';
import { tierLabel, type TierChoice } from './move-stage';

export interface DealFormValues {
  id: string;
  title: string;
  year: number;
  entity: Entity;
  askType: AskType;
  stage: DealStage;
  tierId: string | null;
  amountMinor: number | null;
  expectedCloseDate: Date | string | null;
  nextAction: string | null;
  nextActionDue: Date | string | null;
  ownerId: string | null;
  proposalUrl: string | null;
  /** A deal that already created a membership cannot change its ask or tier. */
  locked: boolean;
}

function DealForm({
  partnerId,
  deal,
  tiers,
  users,
  onDone,
}: {
  partnerId: string;
  deal?: DealFormValues;
  tiers: readonly TierChoice[];
  users: readonly UserOption[];
  onDone: () => void;
}) {
  const create = useAction(createDealAction, { onSuccess: onDone });
  const update = useAction(updateDealAction, { onSuccess: onDone });
  const action = deal ? update : create;
  const errors = action.fieldErrors;
  const [askType, setAskType] = useState<AskType>(deal?.askType ?? 'CORPORATE_MEMBERSHIP');
  const [year, setYear] = useState<number>(deal?.year ?? DEFAULT_YEAR);
  const isMembership = askType === 'CORPORATE_MEMBERSHIP';
  const key = deal?.id ?? 'new';
  // An inactive tier the deal already uses still has to be selectable.
  const currentTierHidden = Boolean(deal?.tierId && !tiers.some((tier) => tier.id === deal.tierId));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const values = readForm(event.currentTarget);
        if (deal) {
          // Disabled controls are not submitted; a locked deal keeps its ask and tier.
          const locked = deal.locked
            ? { askType: deal.askType, tierId: deal.tierId ?? undefined }
            : {};
          void update.run({ ...values, ...locked, id: deal.id });
        } else void create.run({ ...values, partnerId });
      }}
    >
      {action.error && Object.keys(errors).length > 0 && (
        <Alert tone="danger" dense>
          {action.error}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="What we are asking for"
          htmlFor={`d-ask-${key}`}
          required
          error={fieldError(errors, 'askType')}
        >
          <Select
            id={`d-ask-${key}`}
            name="askType"
            value={askType}
            disabled={deal?.locked}
            onChange={(event) => setAskType(event.target.value as AskType)}
          >
            {ASK_TYPES.map((value) => (
              <option key={value} value={value}>
                {ASK_TYPE_LABEL[value].label}
              </option>
            ))}
          </Select>
        </Field>
        {isMembership ? (
          <Field
            label="Membership tier"
            htmlFor={`d-tier-${key}`}
            hint="Required from the proposal onwards. The tier's price becomes the deal value."
            error={fieldError(errors, 'tierId')}
          >
            <Select
              id={`d-tier-${key}`}
              name="tierId"
              defaultValue={deal?.tierId ?? ''}
              disabled={deal?.locked}
            >
              <option value="">Not chosen yet</option>
              {deal?.tierId && currentTierHidden && (
                <option value={deal.tierId}>Current tier (inactive)</option>
              )}
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tierLabel(tier)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label="Estimated value (USD)"
            htmlFor={`d-amount-${key}`}
            hint="Optional. Counts toward the weighted pipeline."
            error={fieldError(errors, 'amount')}
          >
            <Input
              id={`d-amount-${key}`}
              name="amount"
              inputMode="decimal"
              placeholder="25000"
              defaultValue={
                deal && deal.askType !== 'CORPORATE_MEMBERSHIP'
                  ? minorToDollarsInput(deal.amountMinor)
                  : ''
              }
            />
          </Field>
        )}
        <Field label="Year" htmlFor={`d-year-${key}`} required error={fieldError(errors, 'year')}>
          <Input
            id={`d-year-${key}`}
            name="year"
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </Field>
        <Field label="For" htmlFor={`d-entity-${key}`} error={fieldError(errors, 'entity')}>
          <Select id={`d-entity-${key}`} name="entity" defaultValue={deal?.entity ?? 'AHN'}>
            {ENTITIES.map((value) => (
              <option key={value} value={value}>
                {ENTITY_LABEL[value].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="Title"
        htmlFor={`d-title-${key}`}
        hint="Leave empty to use the standard name."
        error={fieldError(errors, 'title')}
      >
        <Input
          id={`d-title-${key}`}
          name="title"
          maxLength={200}
          placeholder={defaultDealTitle(Number.isInteger(year) ? year : DEFAULT_YEAR, askType)}
          defaultValue={deal?.title ?? ''}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {!deal && (
          <Field label="Stage" htmlFor={`d-stage-${key}`} error={fieldError(errors, 'stage')}>
            <Select id={`d-stage-${key}`} name="stage" defaultValue="PROSPECT">
              {OPEN_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {DEAL_STAGE_LABEL[stage].label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Owner" htmlFor={`d-owner-${key}`} error={fieldError(errors, 'ownerId')}>
          <Select id={`d-owner-${key}`} name="ownerId" defaultValue={deal?.ownerId ?? ''}>
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Next action"
          htmlFor={`d-next-${key}`}
          error={fieldError(errors, 'nextAction')}
          className="sm:col-span-2"
        >
          <Input
            id={`d-next-${key}`}
            name="nextAction"
            maxLength={500}
            placeholder="Send the proposal deck to..."
            defaultValue={deal?.nextAction ?? ''}
          />
        </Field>
        <Field
          label="Next action due"
          htmlFor={`d-due-${key}`}
          error={fieldError(errors, 'nextActionDue')}
        >
          <Input
            id={`d-due-${key}`}
            name="nextActionDue"
            type="date"
            defaultValue={toDateInput(deal?.nextActionDue)}
          />
        </Field>
        <Field
          label="Expected close"
          htmlFor={`d-close-${key}`}
          error={fieldError(errors, 'expectedCloseDate')}
        >
          <Input
            id={`d-close-${key}`}
            name="expectedCloseDate"
            type="date"
            defaultValue={toDateInput(deal?.expectedCloseDate)}
          />
        </Field>
      </div>
      <Field
        label="Proposal link"
        htmlFor={`d-proposal-${key}`}
        hint="A link to the deck or PDF (Drive, Dropbox...). Files are not uploaded here."
        error={fieldError(errors, 'proposalUrl')}
      >
        <Input
          id={`d-proposal-${key}`}
          name="proposalUrl"
          placeholder="https://"
          defaultValue={deal?.proposalUrl ?? ''}
        />
      </Field>
      <FormActions>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={action.pending}>
          {deal ? 'Save deal' : 'Create deal'}
        </Button>
      </FormActions>
    </form>
  );
}

export function NewDealButton({
  partnerId,
  partnerName,
  tiers,
  users,
}: {
  partnerId: string;
  partnerName: string;
  tiers: readonly TierChoice[];
  users: readonly UserOption[];
}) {
  return (
    <DialogTrigger
      title={`New deal with ${partnerName}`}
      description="One concrete ask for one year. Vary the ask by relationship: membership, referral or strategic."
      size="lg"
      trigger={(open) => (
        <Button size="xs" variant="secondary" onClick={open}>
          <Plus className="size-3.5" />
          New deal
        </Button>
      )}
    >
      {(close) => <DealForm partnerId={partnerId} tiers={tiers} users={users} onDone={close} />}
    </DialogTrigger>
  );
}

export function EditDealButton({
  partnerId,
  deal,
  tiers,
  users,
}: {
  partnerId: string;
  deal: DealFormValues;
  tiers: readonly TierChoice[];
  users: readonly UserOption[];
}) {
  return (
    <DialogTrigger
      title={`Edit ${deal.title}`}
      size="lg"
      trigger={(open) => (
        <Button size="xs" variant="ghost" onClick={open}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
      )}
    >
      {(close) => (
        <DealForm partnerId={partnerId} deal={deal} tiers={tiers} users={users} onDone={close} />
      )}
    </DialogTrigger>
  );
}
